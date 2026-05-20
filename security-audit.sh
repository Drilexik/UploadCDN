#!/bin/bash

# Security Audit Script for UploadCDN
# Run this regularly to check for security issues

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== UploadCDN Security Audit ===${NC}\n"

FAILED=0

# 1. Check .env file
echo -e "${YELLOW}[1] Checking .env file...${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}✗ .env file not found${NC}"
    FAILED=$((FAILED + 1))
else
    if grep -q "ADMIN_PASSWORD=changeme" .env; then
        echo -e "${RED}✗ Default password detected${NC}"
        FAILED=$((FAILED + 1))
    elif grep -q "ADMIN_PASSWORD=YourSecurePassword" .env; then
        echo -e "${RED}✗ Example password still in use${NC}"
        FAILED=$((FAILED + 1))
    else
        echo -e "${GREEN}✓ ADMIN_PASSWORD is configured${NC}"
    fi
fi

# 2. Check dependency vulnerabilities
echo -e "\n${YELLOW}[2] Checking for vulnerable dependencies...${NC}"
if command -v npm &> /dev/null; then
    VULNS=$(npm audit 2>/dev/null | grep -c "vulnerabilities" || true)
    if [ "$VULNS" -gt 0 ]; then
        echo -e "${RED}✗ Vulnerabilities found - run 'npm audit' for details${NC}"
        FAILED=$((FAILED + 1))
    else
        echo -e "${GREEN}✓ No known vulnerabilities${NC}"
    fi
else
    echo -e "${YELLOW}⊘ npm not found - skipping dependency check${NC}"
fi

# 3. Check for hardcoded secrets
echo -e "\n${YELLOW}[3] Scanning for hardcoded secrets...${NC}"
SECRETS=$(grep -r "password\|secret\|key\|token" app/ lib/ --include="*.js" 2>/dev/null | grep -v "ADMIN_PASSWORD" | grep -v "process.env" | wc -l || true)
if [ "$SECRETS" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found potential hardcoded secrets:${NC}"
    grep -r "password\|secret\|key\|token" app/ lib/ --include="*.js" 2>/dev/null | grep -v "ADMIN_PASSWORD" | grep -v "process.env" | head -5
    FAILED=$((FAILED + 1))
else
    echo -e "${GREEN}✓ No obvious hardcoded secrets${NC}"
fi

# 4. Check file permissions
echo -e "\n${YELLOW}[4] Checking file permissions...${NC}"
if [ -f .env ]; then
    PERMS=$(stat -f %a .env 2>/dev/null || stat -c %a .env 2>/dev/null || echo "unknown")
    if [[ "$PERMS" != "600" ]] && [[ "$PERMS" != "640" ]]; then
        echo -e "${YELLOW}⚠ .env permissions are $PERMS (recommended: 600)${NC}"
    else
        echo -e "${GREEN}✓ .env permissions are secure${NC}"
    fi
fi

# 5. Check .gitignore
echo -e "\n${YELLOW}[5] Checking .gitignore...${NC}"
if grep -q "\.env" .gitignore && grep -q "node_modules" .gitignore; then
    echo -e "${GREEN}✓ .gitignore configured correctly${NC}"
else
    echo -e "${RED}✗ .gitignore may be incomplete${NC}"
    FAILED=$((FAILED + 1))
fi

# 6. Check security headers in code
echo -e "\n${YELLOW}[6] Checking for security headers...${NC}"
if grep -r "X-Content-Type-Options\|X-Frame-Options\|Strict-Transport-Security" app/ --include="*.js" > /dev/null 2>&1 || \
   grep -q "X-Content-Type-Options" next.config.js middleware.js 2>/dev/null; then
    echo -e "${GREEN}✓ Security headers configured${NC}"
else
    echo -e "${YELLOW}⚠ Security headers may not be configured${NC}"
fi

# 7. Check rate limiting
echo -e "\n${YELLOW}[7] Checking rate limiting implementation...${NC}"
if grep -r "createRateLimiter\|rate.*limit" app/ lib/ --include="*.js" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Rate limiting implemented${NC}"
else
    echo -e "${RED}✗ Rate limiting not found${NC}"
    FAILED=$((FAILED + 1))
fi

# 8. Check path traversal protection
echo -e "\n${YELLOW}[8] Checking path traversal protection...${NC}"
if grep -r "validateFilePath\|path.resolve" app/ lib/ --include="*.js" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Path traversal protection implemented${NC}"
else
    echo -e "${RED}✗ Path traversal protection not found${NC}"
    FAILED=$((FAILED + 1))
fi

# 9. Docker security
echo -e "\n${YELLOW}[9] Checking Docker security...${NC}"
if grep -q "USER" Dockerfile && ! grep -q "USER root" Dockerfile; then
    echo -e "${GREEN}✓ Docker runs as non-root user${NC}"
else
    echo -e "${YELLOW}⚠ Docker may not be running as non-root${NC}"
fi

# 10. Check for TODO security comments
echo -e "\n${YELLOW}[10] Checking for TODO security comments...${NC}"
TODOS=$(grep -r "TODO.*security\|FIXME.*security\|HACK" app/ lib/ --include="*.js" 2>/dev/null | wc -l || true)
if [ "$TODOS" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found $TODOS security-related TODO comments:${NC}"
    grep -r "TODO.*security\|FIXME.*security\|HACK" app/ lib/ --include="*.js" 2>/dev/null
    FAILED=$((FAILED + 1))
else
    echo -e "${GREEN}✓ No outstanding security TODOs${NC}"
fi

# Summary
echo -e "\n${YELLOW}=== Audit Summary ===${NC}"
if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}✓ All security checks passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ $FAILED security issues found${NC}"
    exit 1
fi
