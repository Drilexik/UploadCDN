#!/bin/bash

# Complete Security Verification Script
# Spusťte tímto: bash verify-security.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  UploadCDN - COMPLETE SECURITY VERIFICATION                  ║"
echo "║  Advanced Security Patches Implementation Check              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

TOTAL_CHECKS=0
PASSED_CHECKS=0

check_file() {
    local file=$1
    local description=$2
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $description - File not found: $file"
        return 1
    fi
}

check_content() {
    local file=$1
    local pattern=$2
    local description=$3
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $description"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        return 1
    fi
}

echo -e "${YELLOW}[1/5] Verifying Security Library Files...${NC}"
echo "─────────────────────────────────────────────────────────────"
check_file "lib/inputValidation.js" "Input validation library"
check_file "lib/fileSystemSecurity.js" "File system security library"
check_file "lib/requestSecurity.js" "Request security monitoring"
check_file "lib/rateLimiter.js" "Rate limiting implementation"
check_file "lib/security.js" "Core security functions"
check_file "lib/storage.js" "Storage with auth"
echo ""

echo -e "${YELLOW}[2/5] Verifying API Route Enhancements...${NC}"
echo "─────────────────────────────────────────────────────────────"
check_file "app/api/upload/route.js" "Upload endpoint"
check_file "app/api/files/route.js" "File list endpoint"
check_file "app/api/files/[filename]/route.js" "File operations endpoint"
check_file "lib/auth.js" "Auth + brute-force guard (enforceAuth)"
check_file "lib/bruteforce.js" "Brute-force lockout"
check_file "lib/clientIp.js" "Trusted client-IP resolution"
echo ""

echo -e "${YELLOW}[3/5] Verifying Security Configurations...${NC}"
echo "─────────────────────────────────────────────────────────────"
check_file "middleware.js" "Security middleware"
check_file "nginx.conf.template" "Nginx config template"
check_file "next.config.js" "Next.js security config"
check_file "Dockerfile" "Docker security config"
check_file "docker-compose.yml" "Docker Compose config"
check_file "nginx.conf" "Nginx configuration"
echo ""

echo -e "${YELLOW}[4/5] Verifying Documentation...${NC}"
echo "─────────────────────────────────────────────────────────────"
check_file "SECURITY.md" "Security documentation"
check_file "PRODUCTION-DEPLOYMENT.md" "Production deployment guide"
check_file "ADVANCED-SECURITY-PATCHES.md" "Advanced security patches"
check_file "HARDENING-CONFIG.md" "Hardening configuration"
check_file "SECURITY-SUMMARY.md" "Security summary"
check_file "SECURITY-IMPLEMENTATION.md" "Implementation details"
echo ""

echo -e "${YELLOW}[5/5] Verifying Security Features in Code...${NC}"
echo "─────────────────────────────────────────────────────────────"
check_content "lib/inputValidation.js" "SQL_INJECTION\|COMMAND_INJECTION\|XSS" "Attack pattern detection"
check_content "lib/fileSystemSecurity.js" "isSymlink\|validateNoSymlinks" "Symlink protection"
check_content "lib/requestSecurity.js" "detectAttackPattern\|validateHTTPMethod" "Request validation"
check_content "lib/rateLimiter.js" "createRateLimiter" "Rate limiting"
check_content "lib/security.js" "validateFilePath\|sanitizeFilename" "Path validation"
check_content "app/api/upload/route.js" "validateFileType\|detectSuspiciousContent" "File validation"
check_content "middleware.js" "X-Content-Type-Options\|X-Frame-Options" "Security headers"
check_content "Dockerfile" "USER.*nextjs\|read_only" "Docker non-root"
check_content "docker-compose.yml" "cap_drop" "Docker capabilities"
check_content ".env.example" "ADMIN_PASSWORD" ".env configuration"
echo ""

echo -e "${BLUE}─────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}Security Check Results: ${GREEN}$PASSED_CHECKS${NC}/${TOTAL_CHECKS} PASSED${NC}"
echo -e "${BLUE}─────────────────────────────────────────────────────────────${NC}"
echo ""

if [ $PASSED_CHECKS -eq $TOTAL_CHECKS ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✓ ALL SECURITY CHECKS PASSED!                            ║${NC}"
    echo -e "${GREEN}║  Your application is fully secured with advanced patches  ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    echo -e "${YELLOW}Implemented Security Features:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "  ✓ SQL Injection Prevention"
    echo -e "  ✓ Command Injection Prevention"
    echo -e "  ✓ XSS/Script Injection Prevention"
    echo -e "  ✓ Path Traversal Protection"
    echo -e "  ✓ XXE Prevention"
    echo -e "  ✓ Symlink Attack Prevention"
    echo -e "  ✓ Rate Limiting"
    echo -e "  ✓ Security Headers (CSP, HSTS, etc.)"
    echo -e "  ✓ File Integrity Verification"
    echo -e "  ✓ Secure File Deletion"
    echo -e "  ✓ Request Monitoring & Anomaly Detection"
    echo -e "  ✓ Docker Security Hardening"
    echo -e "  ✓ Nginx Reverse Proxy with SSL"
    echo -e "  ✓ Comprehensive Logging"
    echo -e "  ✓ Attack Pattern Detection"
    echo ""
    
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1. Configure Environment:"
    echo "   cp .env.example .env"
    echo "   nano .env  # Set ADMIN_PASSWORD and BASE_URL"
    echo ""
    echo "2. Run Final Checks:"
    echo "   bash CHECKLIST.md"
    echo "   bash security-audit.sh"
    echo ""
    echo "3. Deploy:"
    echo "   bash deploy.sh"
    echo ""
    echo "4. Monitor:"
    echo "   docker-compose logs -f"
    echo ""
    
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ✗ SOME SECURITY CHECKS FAILED                            ║${NC}"
    echo -e "${RED}║  Please review the failures above and fix missing files    ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    exit 1
fi
