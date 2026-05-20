#!/bin/bash

# VPS Production Security Checklist
# Complete this checklist before deploying UploadCDN to production

echo "=== UploadCDN VPS Production Security Checklist ==="
echo ""

CHECKS=0
PASSED=0

check() {
    CHECKS=$((CHECKS + 1))
    if [ "$1" -eq 1 ]; then
        echo -e "✓ $2"
        PASSED=$((PASSED + 1))
    else
        echo -e "✗ $2"
    fi
}

echo "=== System Level ==="
# 1.1
if command -v docker &> /dev/null; then
    check 1 "Docker installed"
else
    check 0 "Docker installed"
fi

# 1.2
if command -v docker-compose &> /dev/null; then
    check 1 "Docker Compose installed"
else
    check 0 "Docker Compose installed"
fi

# 1.3
if command -v ufw &> /dev/null || command -v firewalld &> /dev/null; then
    check 1 "Firewall available"
else
    check 0 "Firewall available"
fi

echo ""
echo "=== Application Configuration ==="
# 2.1
if [ -f .env ] && ! grep -q "ADMIN_PASSWORD=changeme" .env && ! grep -q "ADMIN_PASSWORD=Your" .env; then
    check 1 "ADMIN_PASSWORD configured with strong password"
else
    check 0 "ADMIN_PASSWORD configured with strong password"
fi

# 2.2
if [ -f .env ] && grep -q "BASE_URL=https://" .env; then
    check 1 "BASE_URL configured with HTTPS"
else
    check 0 "BASE_URL configured with HTTPS"
fi

# 2.3
if grep -q "sanitizeFilename\|validateFilePath" lib/storage.js lib/security.js 2>/dev/null; then
    check 1 "Path sanitization implemented"
else
    check 0 "Path sanitization implemented"
fi

echo ""
echo "=== Security Features ==="
# 3.1
if grep -r "createRateLimiter" app/api/ --include="*.js" > /dev/null 2>&1; then
    check 1 "Rate limiting enabled"
else
    check 0 "Rate limiting enabled"
fi

# 3.2
if grep -q "X-Content-Type-Options\|X-Frame-Options" middleware.js next.config.js 2>/dev/null; then
    check 1 "Security headers configured"
else
    check 0 "Security headers configured"
fi

# 3.3
if grep -q "validateFileType" lib/security.js 2>/dev/null; then
    check 1 "File type validation implemented"
else
    check 0 "File type validation implemented"
fi

echo ""
echo "=== Docker Security ==="
# 4.1
if grep -q "USER" Dockerfile && ! grep -q "USER root" Dockerfile; then
    check 1 "Docker runs as non-root user"
else
    check 0 "Docker runs as non-root user"
fi

# 4.2
if grep -q "HEALTHCHECK" Dockerfile; then
    check 1 "Health checks configured"
else
    check 0 "Health checks configured"
fi

# 4.3
if [ -f docker-compose.yml ] && grep -q "read_only\|cap_drop" docker-compose.yml; then
    check 1 "Container security options configured"
else
    check 0 "Container security options configured"
fi

echo ""
echo "=== SSL/TLS ==="
# 5.1
if [ -f nginx.conf ] && grep -q "ssl" nginx.conf; then
    check 1 "SSL/TLS configured in nginx"
else
    check 0 "SSL/TLS configured in nginx"
fi

# 5.2
if [ -d certs ] && [ -f certs/cert.pem ] && [ -f certs/key.pem ]; then
    check 1 "SSL certificates present"
else
    check 0 "SSL certificates present"
fi

echo ""
echo "=== File Permissions ==="
# 6.1
if [ -f .env ]; then
    PERMS=$(stat -f %a .env 2>/dev/null || stat -c %a .env 2>/dev/null || echo "unknown")
    if [[ "$PERMS" == "600" ]] || [[ "$PERMS" == "640" ]]; then
        check 1 ".env file permissions (600/640)"
    else
        check 0 ".env file permissions (600/640)"
    fi
fi

# 6.2
if grep -q "\.env" .gitignore; then
    check 1 ".env in .gitignore"
else
    check 0 ".env in .gitignore"
fi

echo ""
echo "=== Deployment ==="
# 7.1
if [ -f deploy.sh ] && [ -f hardening.sh ]; then
    check 1 "Deployment scripts available"
else
    check 0 "Deployment scripts available"
fi

# 7.2
if [ -f SECURITY.md ]; then
    check 1 "Security documentation available"
else
    check 0 "Security documentation available"
fi

# 7.3
if [ -f security-audit.sh ]; then
    check 1 "Security audit script available"
else
    check 0 "Security audit script available"
fi

echo ""
echo "=== Summary ==="
echo "Checks passed: $PASSED/$CHECKS"
echo ""

if [ "$PASSED" -eq "$CHECKS" ]; then
    echo "✓ All security requirements met! Ready for production."
    exit 0
else
    MISSING=$((CHECKS - PASSED))
    echo "✗ $MISSING checks failed. Review and fix before deploying."
    exit 1
fi
