#!/usr/bin/env bash
# Shared helpers for buildcdnapp and redeploycdnweb.
# Sourced, never executed directly.

# ── Output helpers ──────────────────────────────────────────────────────────
if [ -t 1 ]; then
  RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
  BLUE=$'\033[0;34m'; BOLD=$'\033[1m'; NC=$'\033[0m'
else
  RED=""; GREEN=""; YELLOW=""; BLUE=""; BOLD=""; NC=""
fi

info()  { printf '%s\n' "${BLUE}➜${NC} $*"; }
ok()    { printf '%s\n' "${GREEN}✓${NC} $*"; }
warn()  { printf '%s\n' "${YELLOW}⚠${NC} $*" >&2; }
err()   { printf '%s\n' "${RED}✗${NC} $*" >&2; }
die()   { err "$*"; exit 1; }
hr()    { printf '%s\n' "${BOLD}──────────────────────────────────────────────────────────${NC}"; }

# Read a yes/no answer. $1=prompt, $2=default(Y|N). Returns 0 for yes.
confirm() {
  local prompt="$1" def="${2:-Y}" ans
  local hint="[Y/n]"; [ "$def" = "N" ] && hint="[y/N]"
  read -r -p "$prompt $hint " ans </dev/tty || ans=""
  ans="${ans:-$def}"
  case "$ans" in [Yy]*) return 0 ;; *) return 1 ;; esac
}

# ── Prerequisites ───────────────────────────────────────────────────────────
compose() { docker compose "$@"; }

check_prereqs() {
  info "Checking prerequisites..."
  command -v docker >/dev/null 2>&1 || die "Docker is not installed."
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is not available ('docker compose')."
  command -v openssl >/dev/null 2>&1 || warn "openssl not found — self-signed certificate generation will be unavailable."
  ok "Docker and Docker Compose found."
}

# ── Directories ─────────────────────────────────────────────────────────────
ensure_dirs() {
  mkdir -p uploads logs/nginx certs
  chmod 755 uploads 2>/dev/null || true
  # The app container runs as uid/gid 1001 (nextjs) on a read-only root FS, so
  # the bind-mounted uploads dir must be owned by that user or writes (and the
  # startup chmod) fail with EPERM/EACCES. Only root on the host can chown.
  if [ "$(id -u)" -eq 0 ]; then
    chown -R 1001:1001 uploads 2>/dev/null || true
  fi
  ok "Directories ready (uploads/, logs/nginx/, certs/)."
}

# ── Admin password ──────────────────────────────────────────────────────────
# Generate a strong random password (only its hash is ever stored).
gen_password() {
  openssl rand -base64 24 | tr -d '\n=' | tr '/+' 'Xy'
}

# Hash a password with salted scrypt -> "<saltHex>:<hashHex>".
# Password is piped via stdin so it never appears in the process list.
hash_admin_password() {
  local pw="$1"
  local script='let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const c=require("crypto");const s=c.randomBytes(16);const h=c.scryptSync(d,s,64);process.stdout.write(s.toString("hex")+":"+h.toString("hex"));});'
  if command -v node >/dev/null 2>&1; then
    printf '%s' "$pw" | node -e "$script"
  else
    printf '%s' "$pw" | docker run --rm -i node:20-alpine node -e "$script"
  fi
}

# Interactively obtain ADMIN_HASH (sets global ADMIN_HASH). Shows generated
# passwords once so the operator can store them.
configure_admin_password() {
  ADMIN_HASH=""
  local pw pw2
  echo
  echo "Admin password:"
  echo "  [1] Generate a strong random password (recommended)"
  echo "  [2] Enter my own"
  local choice
  read -r -p "Choose [1]: " choice </dev/tty || choice="1"
  choice="${choice:-1}"

  if [ "$choice" = "2" ]; then
    while true; do
      read -r -s -p "Enter admin password (min 16 chars): " pw </dev/tty; echo
      read -r -s -p "Confirm password: " pw2 </dev/tty; echo
      if [ "$pw" != "$pw2" ]; then err "Passwords do not match. Try again."; continue; fi
      if [ "${#pw}" -lt 16 ]; then err "Too short — use at least 16 characters."; continue; fi
      break
    done
  else
    pw="$(gen_password)"
    hr
    printf '%s\n' "${BOLD}${YELLOW}  Generated admin password (SAVE IT NOW — shown only once):${NC}"
    printf '%s\n' "${BOLD}    $pw${NC}"
    hr
    confirm "Saved it?" "Y" || die "Aborted — store the password and re-run."
  fi

  info "Hashing password (scrypt)..."
  ADMIN_HASH="$(hash_admin_password "$pw")"
  [ -n "$ADMIN_HASH" ] || die "Failed to hash password (is node or docker available?)."
  unset pw pw2
  ok "Password hashed — plaintext is not stored."
}

# ── Domain ──────────────────────────────────────────────────────────────────
# Sets global DOMAIN. $1 = default (optional).
configure_domain() {
  local def="$1" input
  while true; do
    if [ -n "$def" ]; then
      read -r -p "Domain name [$def]: " input </dev/tty || input=""
      input="${input:-$def}"
    else
      read -r -p "Domain name (e.g. upload.example.com): " input </dev/tty || input=""
    fi
    input="${input#http://}"; input="${input#https://}"; input="${input%%/*}"
    if printf '%s' "$input" | grep -Eq '^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'; then
      DOMAIN="$input"; break
    fi
    err "That doesn't look like a valid domain. Try again."
  done
}

# ── .env ────────────────────────────────────────────────────────────────────
# write_env <hash> <base_url>
write_env() {
  local hash="$1" base_url="$2"
  ( umask 077; cat > .env <<EOF
# Generated by UploadCDN deploy scripts. Do not commit.
ADMIN_PASSWORD_HASH=$hash
ADMIN_PASSWORD=
BASE_URL=$base_url
PORT=3000
UPLOADS_DIR=/app/uploads
NODE_ENV=production
EOF
  )
  chmod 600 .env 2>/dev/null || true
  ok ".env written (permissions 600)."
}

# Read a key from .env (value after first '='). $1 = key.
env_get() {
  [ -f .env ] || return 0
  grep -E "^$1=" .env | head -n1 | cut -d= -f2-
}

# ── nginx.conf ──────────────────────────────────────────────────────────────
# render_nginx_conf <domain> [max_body]
render_nginx_conf() {
  local domain="$1" maxbody="${2:-105M}"
  [ -f nginx.conf.template ] || die "nginx.conf.template not found."
  sed -e "s/__DOMAIN__/${domain}/g" -e "s/__MAX_BODY__/${maxbody}/g" \
    nginx.conf.template > nginx.conf
  ok "nginx.conf generated for ${domain}."
}

# ── Certificates ────────────────────────────────────────────────────────────
setup_certs() {
  local domain="$1"
  mkdir -p certs
  if [ -f certs/cert.pem ] && [ -f certs/key.pem ]; then
    if confirm "Existing certificates found in ./certs — reuse them?" "Y"; then
      ok "Reusing existing certificates."
      return 0
    fi
  fi

  echo
  echo "TLS certificate:"
  echo "  [1] Self-signed (testing, or behind a Cloudflare/Traefik proxy that terminates TLS)"
  echo "  [2] Let's Encrypt via certbot (needs DNS pointing here + ports 80/443 free)"
  echo "  [3] I'll place my own cert.pem/key.pem in ./certs"
  local mode
  read -r -p "Choose [1]: " mode </dev/tty || mode="1"
  mode="${mode:-1}"

  case "$mode" in
    2) setup_letsencrypt "$domain" ;;
    3) warn "Place your PEM files at ./certs/cert.pem and ./certs/key.pem before the site will serve HTTPS." ;;
    *) gen_self_signed "$domain" ;;
  esac
}

gen_self_signed() {
  local domain="$1"
  command -v openssl >/dev/null 2>&1 || die "openssl required for self-signed certs."
  info "Generating self-signed certificate for ${domain}..."
  openssl req -x509 -newkey rsa:4096 -nodes \
    -keyout certs/key.pem -out certs/cert.pem -days 365 \
    -subj "/CN=${domain}" -addext "subjectAltName=DNS:${domain}" >/dev/null 2>&1
  chmod 600 certs/key.pem 2>/dev/null || true
  ok "Self-signed certificate created (browsers will warn; fine behind a TLS-terminating proxy)."
}

setup_letsencrypt() {
  local domain="$1" email
  if ! command -v certbot >/dev/null 2>&1; then
    warn "certbot is not installed. Install it (e.g. 'apt-get install certbot') and re-run, or choose self-signed."
    if confirm "Fall back to a self-signed certificate now?" "Y"; then
      gen_self_signed "$domain"; return 0
    fi
    die "certbot missing."
  fi
  read -r -p "Email for Let's Encrypt notices: " email </dev/tty || email=""
  [ -n "$email" ] || die "An email is required for Let's Encrypt."

  local SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
  info "Stopping nginx container (if running) to free port 80..."
  compose stop nginx >/dev/null 2>&1 || true

  info "Requesting certificate via certbot standalone..."
  $SUDO certbot certonly --standalone --non-interactive --agree-tos \
    -m "$email" -d "$domain" || die "certbot failed (check DNS and that ports 80/443 are open)."

  local live="/etc/letsencrypt/live/${domain}"
  $SUDO cp "${live}/fullchain.pem" certs/cert.pem
  $SUDO cp "${live}/privkey.pem"  certs/key.pem
  $SUDO chown "$(id -u):$(id -g)" certs/cert.pem certs/key.pem 2>/dev/null || true
  chmod 600 certs/key.pem 2>/dev/null || true
  ok "Let's Encrypt certificate installed."
  warn "Renewal: certs auto-renew, but you must re-copy them and reload nginx. Suggested deploy hook:"
  printf '   %s\n' "certbot renew --deploy-hook 'cp /etc/letsencrypt/live/${domain}/fullchain.pem $(pwd)/certs/cert.pem && cp /etc/letsencrypt/live/${domain}/privkey.pem $(pwd)/certs/key.pem && docker compose -f $(pwd)/docker-compose.yml exec nginx nginx -s reload'"
}

# ── fail2ban (optional) ─────────────────────────────────────────────────────
install_fail2ban() {
  command -v fail2ban-client >/dev/null 2>&1 || {
    warn "fail2ban not installed — skipping. Install with 'apt-get install fail2ban' then re-run to enable IP banning."
    return 0
  }
  local SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
  local logpath="$(pwd)/logs/nginx/access.log"
  info "Installing fail2ban filter and jail for UploadCDN..."
  $SUDO cp fail2ban/filter.d/uploadcdn.conf /etc/fail2ban/filter.d/uploadcdn.conf
  sed "s#__LOGPATH__#${logpath}#g" fail2ban/jail.d/uploadcdn.local \
    | $SUDO tee /etc/fail2ban/jail.d/uploadcdn.local >/dev/null
  $SUDO systemctl reload fail2ban 2>/dev/null || $SUDO fail2ban-client reload 2>/dev/null || true
  ok "fail2ban jail 'uploadcdn' installed (bans IPs with repeated 401/429 on /api/)."
}

# ── Build / run / health ────────────────────────────────────────────────────
build_and_start() {
  info "Building Docker image..."
  compose build
  ok "Image built."

  info "Starting services..."
  compose up -d
  ok "Services started."

  info "Waiting for health checks..."
  sleep 6
  compose ps
}

print_summary() {
  local base_url="$1"
  echo
  hr
  ok "UploadCDN is deployed."
  printf '   URL:      %s\n' "${BOLD}${base_url}${NC}"
  printf '   Logs:     %s\n' "docker compose logs -f"
  printf '   Stop:     %s\n' "docker compose down"
  printf '   Security: %s\n' "see SECURITY-AUDIT.md"
  hr
}
