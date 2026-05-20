# 🔒 UploadCDN - Security Implementation Summary

## Implementované bezpečnostní opatření

### ✅ 1. Ochrana proti Path Traversal útokům
**Problém**: Útočník by mohl používat `../` nebo symlinky k zápisu mimo `UPLOADS_DIR`

**Řešení**:
- Přidána funkce `validateFilePath()` v [lib/security.js](lib/security.js)
- Všechny cesty jsou kontrolovány pomocí `path.resolve()`
- Zajišťuje, že soubory zůstávají v určeném adresáři

**Soubory**: [lib/security.js](lib/security.js), [app/api/upload/route.js](app/api/upload/route.js)

---

### ✅ 2. Validace typu souboru
**Problém**: Útočník by mohl nahrát malware/spustitelné soubory

**Řešení**:
- Whitelist povolených MIME typů v [lib/security.js](lib/security.js)
- Blacklist nebezpečných rozšíření: `.exe`, `.bat`, `.sh`, `.dll`, atd.
- Validace před uložením souboru

**Soubory**: [lib/security.js](lib/security.js), [app/api/upload/route.js](app/api/upload/route.js)

---

### ✅ 3. Rate Limiting
**Problém**: Brute force útoky na heslo, DoS útoky

**Řešení**:
- `/api/upload` - 1 request za minutu
- `/api/files` - 10 requests za minutu  
- Ostatní operace - 5 requests za minutu
- Vrací 429 se `Retry-After` headerem

**Soubory**: [lib/rateLimiter.js](lib/rateLimiter.js), všechny API routes

---

### ✅ 4. Bezpečnostní Headery
**Problém**: XSS, clickjacking, MIME sniffing útoky

**Řešení**:
- `X-Content-Type-Options: nosniff` - zabrání MIME sniffingu
- `X-Frame-Options: DENY` - prevence clickjackingu
- `X-XSS-Protection: 1; mode=block` - XSS ochrana
- `Content-Security-Policy` - kontrola kdy se mohou zdroje načítat
- `Strict-Transport-Security` - vynucení HTTPS

**Soubory**: [middleware.js](middleware.js), [next.config.js](next.config.js)

---

### ✅ 5. Ochrana .env souboru
**Problém**: Expozice citlivých údajů (heslo, klíče)

**Řešení**:
- `.env` je v [.gitignore](.gitignore) a [.dockerignore](.dockerignore)
- Povinné nastavení `ADMIN_PASSWORD` - aplikace se nestarty bez něj
- Aplikace se nestarty, pokud heslo = `"changeme"`
- Validace minimální délky hesla (16 znaků)
- Kontrola při startu aplikace

**Soubory**: [lib/storage.js](lib/storage.js), [.env.example](.env.example)

---

### ✅ 6. Silné Heslo
**Problém**: Slabé heslo `"changeme"` je snadné uhodnout

**Řešení**:
- Aplikace vyžaduje silné heslo (minimum 16 znaků)
- Kontrola v [lib/storage.js](lib/storage.js)
- Předchází spuštění s výchozím heslem

**Soubory**: [lib/storage.js](lib/storage.js)

---

### ✅ 7. Timing Attack Ochrana
**Problém**: Útočník by mohl ověřit heslo analýzou doby odpovědi

**Řešení**:
- Konstanta-časová porovnání hesla (`constantTimeCompare()`)
- Brání únikům informací o délce hesla
- Používáno v [lib/storage.js](lib/storage.js) v `checkAuth()`

**Soubory**: [lib/storage.js](lib/storage.js)

---

### ✅ 8. Docker Security
**Problém**: Spouštění jako root, bez omezení zdrojů, bez health checks

**Řešení**:
- Spouštění jako non-root uživatel (`nextjs:1001`)
- `read_only` filesystem (kromě `/tmp` a `/app/uploads`)
- Omezené capabilities (`cap_drop: ALL`)
- `no-new-privileges: true`
- Health checks každých 30 sekund
- Limitace CPU (1) a RAM (512MB)

**Soubory**: [Dockerfile](Dockerfile), [docker-compose.yml](docker-compose.yml)

---

### ✅ 9. Zabezpečená Konfigurace
**Problém**: Výchozí povolená všechna rozšíření, žádné komprese

**Řešení**:
- Komprese odpovědí
- Vypnuto `X-Powered-By` header
- Bezpečnostní headers v next.config.js

**Soubory**: [next.config.js](next.config.js)

---

### ✅ 10. Bezpečnostní Logging
**Problém**: Bez záznamů o bezpečnostních incidentech

**Řešení**:
- Loggování všech bezpečnostních akcí:
  - `UNAUTHORIZED_*` - nepovolené přístupy
  - `RATE_LIMIT_EXCEEDED` - překročení limitů
  - `PATH_TRAVERSAL_ATTEMPT` - pokusy o útoky
  - `INVALID_FILE_TYPE` - zakázané typy souborů
  - `FILE_*` - operace se soubory
- Struktura ve formátu JSON pro snadnou analýzu

**Soubory**: [lib/security.js](lib/security.js), všechny API routes

---

### ✅ 11. Nginx Reverse Proxy
**Problém**: Přímý přístup ke aplikaci, bez SSL termination

**Řešení**:
- Nginx jako reverse proxy s SSL/TLS
- Dodatečné rate limiting na úrovni proxy
- Cachování statických souborů
- Ochrana citlivých cest (`/.git`, `/.env`, atd.)
- HTTPS redirect

**Soubory**: [nginx.conf](nginx.conf), [docker-compose.yml](docker-compose.yml)

---

### ✅ 12. Sanitizace Jmen Souborů
**Problém**: Injekce znaků, special characters v názvech souborů

**Řešení**:
- Funkce `sanitizeFilenameSecurity()` v [lib/security.js](lib/security.js)
- Maximální délka 255 znaků
- Povoleny: a-zA-Z0-9._-
- Blokování podezřelých názvů (`.env`, `config.json`, atd.)

**Soubory**: [lib/security.js](lib/security.js)

---

### ✅ 13. Detailní Bezpečnostní Dokumentace
**Soubory**:
- [SECURITY.md](SECURITY.md) - Bezpečnostní politika a reference
- [PRODUCTION-DEPLOYMENT.md](PRODUCTION-DEPLOYMENT.md) - Průvodce nasazením
- [CHECKLIST.md](CHECKLIST.md) - Předdeploymentní kontrola
- [security-audit.sh](security-audit.sh) - Automatizovaná bezpečnostní kontrola

---

## 📋 Nové Bezpečnostní Soubory

| Soubor | Popis |
|--------|-------|
| [lib/security.js](lib/security.js) | Bezpečnostní funkce (validace, sanitizace, logování) |
| [lib/rateLimiter.js](lib/rateLimiter.js) | Implementace rate limitingu |
| [middleware.js](middleware.js) | Next.js middleware pro bezpečnostní headery |
| [docker-compose.yml](docker-compose.yml) | Bezpečná Docker konfigurace |
| [nginx.conf](nginx.conf) | Nginx reverse proxy s SSL |
| [deploy.sh](deploy.sh) | Automatizovaný deployment script |
| [hardening.sh](hardening.sh) | OS security hardening script |
| [security-audit.sh](security-audit.sh) | Automatizovaná bezpečnostní kontrola |
| [SECURITY.md](SECURITY.md) | Bezpečnostní dokumentace |
| [PRODUCTION-DEPLOYMENT.md](PRODUCTION-DEPLOYMENT.md) | Průvodce produkcí |
| [CHECKLIST.md](CHECKLIST.md) | Předdeploymentní kontrola |

---

## 🚀 Jak Nasadit do Produkce

### 1. Příprava
```bash
# Klonování
git clone <repo> && cd uploadcdn

# Konfigurace
cp .env.example .env
nano .env  # Nastavte silné ADMIN_PASSWORD a BASE_URL
```

### 2. Kontrola
```bash
# Spustit bezpečnostní kontrolu
bash CHECKLIST.md

# Spustit bezpečnostní audit
bash security-audit.sh
```

### 3. Nasazení
```bash
# Automatizovaný deployment
bash deploy.sh
```

### 4. Monitoring
```bash
# Sledování logů
docker-compose logs -f

# Bezpečnostní monitoring
docker-compose logs | grep -i "security\|error\|unauthorized"
```

---

## 🔐 Bezpečnostní Checklist pro Produkci

- [ ] ADMIN_PASSWORD nastaveno na silné heslo (16+ znaků)
- [ ] BASE_URL nastaven na HTTPS
- [ ] SSL certifikát vygenerován (Let's Encrypt nebo self-signed)
- [ ] Firewall nakonfigurován (UFW, iptables)
- [ ] Backups nastaveny
- [ ] Monitoring a alerting nakonfigurován
- [ ] Fail2Ban nakonfigurován
- [ ] Log rotation nastaven
- [ ] Security audit script spuštěn
- [ ] Nginx running za aplikací
- [ ] Docker containers běží jako non-root
- [ ] Health checks jsou aktivní

---

## 🆘 Řešení Problémů

### Aplikace se nestarty
```bash
docker-compose logs uploadcdn
# Zkontrolujte ADMIN_PASSWORD a BASE_URL v .env
```

### Vysoký disk usage
```bash
du -sh uploads/
# Smažte staré soubory nebo rozšiřte storage
```

### SSL problémy
```bash
openssl x509 -in certs/cert.pem -text -noout
```

---

## 📚 Dodatečné Zdroje

- [OWASP Top 10](https://owasp.org/Top10/)
- [CWE-22: Path Traversal](https://cwe.mitre.org/data/definitions/22.html)
- [Node.js Security](https://nodejs.org/en/docs/guides/security/)
- [Docker Security](https://docs.docker.com/engine/security/)

---

## 📞 Bezpečnostní Incidenty

Pokud zjistíte bezpečnostní problém:
1. **Nešiřte veřejně**
2. **Email**: security@drilex.cz
3. **Zahrnout**: PoC, detaily, dopad

---

**Všechny bezpečnostní funkce jsou implementovány a připraveny k produkci! ✅**
