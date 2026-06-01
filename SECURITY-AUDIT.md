# UploadCDN — Security Audit & Hardening Report

**Date:** 2026-06-01
**Scope:** Full application (Next.js app, API routes, auth, file handling, Docker/nginx infra, deploy scripts).
**Threat model:** Public internet-facing self-hosted CDN with a single shared admin password protecting upload/list/delete/rename. Anyone can read served files; only the admin can write.

This report covers what was found, what was fixed, and what residual risk remains. Fixes were applied directly to the codebase as part of the "deep hardening" pass.

---

## 1. Exposed passwords / secrets

| Check | Result |
|---|---|
| Secrets committed to git | **None.** Only `.env.example` is tracked; no real `.env`, certs, or keys in history. |
| `.gitignore` / `.dockerignore` cover `.env`, `certs/`, `uploads/` | Yes. |
| Plaintext password in environment | **Fixed** — see #4. |
| Example/default password shipped | **Fixed** — `.env.example` no longer ships `YourSecurePassword123!@#`; the deploy scripts generate a credential and store only its hash. |

> Action for the operator: the old plaintext `ADMIN_PASSWORD` may still exist in your live server's `.env` and in your shell history / deployment platform. Rotate it by running `./redeploycdnweb` (generates a fresh scrypt hash) and clear it from any password-less storage.

---

## 2. Brute-force protection

**Before:** the only protection on the admin password was a generic per-IP rate limit on `GET /api/files` (10 req/min). It had two serious weaknesses:

- **(HIGH) Rate-limit bypass via `X-Forwarded-For` spoofing.** The limiter keyed on the raw `X-Forwarded-For` header. nginx only *appends* the real client IP to that header, so an attacker could send a different fake prefix on every request and get a fresh bucket each time — defeating the limit entirely.
- **(HIGH) No account lockout.** Within the rate cap, guessing could continue indefinitely; there was no escalating block.

**Fixes:**
- `lib/clientIp.js` — resolves the client IP from `X-Real-IP` (set by nginx, not forgeable) and falls back to the **last** hop of `X-Forwarded-For`. The rate limiter and lockout now use this. **Bypass closed.**
- `lib/bruteforce.js` — per-IP failed-auth tracking with an **escalating lockout** (8 failures / 15 min → 15 min block, doubling on repeat offenders up to 24 h). Successful auth clears the counter.
- `lib/auth.js` (`enforceAuth`) — single guard wired into every authenticated route (`/api/files`, `/api/upload`, `/api/files/[filename]` DELETE+PATCH): lockout check → password verify → record result. Emits `AUTH_FAILED` / `AUTH_LOCKOUT` / `AUTH_BLOCKED_LOCKOUT` security logs.
- **nginx** — dedicated `login_limit` zone on `GET /api/files`, `limit_req_status 429`, and a per-IP connection cap.
- **fail2ban** (`fail2ban/`) — filter + jail that ban IPs at the OS firewall after repeated `401`/`429` on `/api/`. Defense-in-depth below the app. nginx now logs to `logs/nginx/access.log` (bind mount) so fail2ban can read it. The deploy script offers to install this.

---

## 3. Stored XSS via uploaded files (HIGH)

**Before:** `image/svg+xml` is an allowed upload type, and the public file route served files with their content-type, `Access-Control-Allow-Origin: *`, **no `X-Content-Type-Options`, and no CSP**. A user opening `https://<cdn>/evil.svg` directly would execute any `<script>` inside it **in the CDN's origin** (stored XSS). HTML/XML had the same problem.

**Fix (`app/[...slug]/route.js`):**
- `X-Content-Type-Options: nosniff` on every served file.
- For active document types (`.svg/.html/.htm/.xml/.xhtml`) and the unknown `application/octet-stream` fallback: `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` — scripts cannot run even on direct navigation. SVGs embedded via `<img>` still render.
- `.html/.htm/.xml/.xhtml` and unknown types are sent as `Content-Disposition: attachment` (download, never rendered inline).
- Added canonical path-traversal validation (`validateFilePath`) and symlink rejection on the serve path (previously only a naive `..` string check).

---

## 4. Password storage & comparison (MEDIUM)

- **scrypt hashing** — admin password is now stored as a salted scrypt hash in `ADMIN_PASSWORD_HASH` (`<saltHex>:<hashHex>`, 16-byte salt, 64-byte digest). The plaintext never touches `.env`. Verified the script's hash generation and `storage.js` verification agree (round-trip tested).
- **Legacy fallback** — `ADMIN_PASSWORD` plaintext still works (with a startup warning) so existing deployments don't break; migrate by re-running `./redeploycdnweb`.
- **Comparison** — replaced the hand-rolled compare (which early-returned on length mismatch, leaking password length) with `crypto.timingSafeEqual` over fixed-length digests / scrypt output.

---

## 5. Dead / dangerous "enhanced" code (MEDIUM)

The repo contained `route-enhanced.js` files and `middleware-advanced.js` that were **never loaded by Next.js** (it only runs `route.js` and the root `middleware.js`). They gave a false sense of protection, and `middleware-advanced.js` was actively unsafe if anyone had wired it in:

- it read the **entire request body** (`await request.text()`) for every POST/PUT/PATCH — which would have **broken file uploads** by consuming the stream; and
- it imported `lib/security.js` (which pulls in `fs`), which **crashes the Edge runtime** middleware runs in.

**Fix:** merged the genuinely useful, safe checks into the active handlers and removed the dead duplicates:
- Upload/file routes now do strict filename validation, symlink rejection, and magic-byte content sniffing.
- `middleware.js` now blocks URL path-traversal and known scanners (sqlmap/nikto/…) and strips server headers — **without** reading the body and **without** Node-only imports.
- Deleted: `middleware-advanced.js`, `app/api/upload/route-enhanced.js`, `app/api/files/[filename]/route-enhanced.js` (recoverable via git).

Also fixed a latent bug in `detectSuspiciousContent`: it matched magic bytes anywhere in the file (`buffer.includes`), which false-positives on legitimate zip/pdf/mp4 files. It now checks the file **header** only.

---

## 6. Other fixes

- **Rate limiter memory** — added a periodic sweep so the in-memory map can't grow unbounded from rotating IPs.
- **nginx** — `server_tokens off`, modernized `http2` directive, raised `client_max_body_size` to 105M so genuine 100 MB uploads aren't rejected by multipart overhead, `proxy_request_buffering off` for uploads.
- **`verify-security.sh`** — updated to the new file layout and fixed a pre-existing `docker-compose.js` typo that aborted the script under `set -e`.

---

## 7. Residual risks & recommendations (accepted / future work)

- **Single shared password, no MFA/sessions.** Acceptable for a one-admin tool. The browser stores the password in `localStorage` (`cdn_pw`); the CSP reduces XSS exfiltration risk, but consider a short-lived session token if this grows.
- **In-memory rate limit & lockout are per-process.** Fine for the single-container compose setup; move to Redis if you run multiple replicas (otherwise each replica has its own counter).
- **SVG is still an allowed upload type** (needed for logos/favicons). It is now served safely (sandboxed, nosniff), but if you don't need SVG, drop `image/svg+xml` from `ALLOWED_MIME_TYPES` in `lib/security.js`, or add server-side SVG sanitization (e.g. DOMPurify) for belt-and-braces.
- **CSP allows `'unsafe-inline'`/`'unsafe-eval'`** in `script-src` (Next.js dev/runtime needs it). Tightening to nonces is possible but intrusive.
- **Self-signed certs by default.** Choose Let's Encrypt in the deploy script for a public domain, or terminate TLS at Cloudflare/Traefik.

---

## 8. Verification status

- Bash scripts: `bash -n` syntax-checked; `verify-security.sh` passes all checks.
- scrypt hash ↔ `storage.js` verification: round-trip tested (correct password ✓, wrong password ✗).
- nginx template renders with no leftover placeholders; domain validation tested.
- **Full `next build` / `docker compose build` was NOT run** in the audit environment (no Docker daemon / `node_modules` available here). Before going live, validate with:

  ```bash
  ./redeploycdnweb --keep      # or: docker compose build && docker compose up -d
  docker compose logs -f       # watch for AUTH_* / startup credential warnings
  ```

  Import integrity was checked statically: all new `@/lib/*` imports resolve (`@/* → ./*` via jsconfig), there are no circular imports, and no route references the removed symbols.
