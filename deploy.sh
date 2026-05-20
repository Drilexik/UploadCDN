#!/bin/bash

# Production Deployment Guide for UploadCDN

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== UploadCDN Production Deployment ===${NC}"

# 1. Check prerequisites
echo -e "\n${YELLOW}[1/7] Checking prerequisites...${NC}"
command -v docker &> /dev/null || { echo -e "${RED}Docker is not installed${NC}"; exit 1; }
command -v docker-compose &> /dev/null || { echo -e "${RED}Docker Compose is not installed${NC}"; exit 1; }
echo -e "${GREEN}✓ Docker and Docker Compose found${NC}"

# 2. Check .env file
echo -e "\n${YELLOW}[2/7] Checking environment configuration...${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}✗ .env file not found${NC}"
    echo \"Copy .env.example to .env and configure:\"
    echo \"  cp .env.example .env\"
    echo \"  nano .env\"
    exit 1
fi

# Check if ADMIN_PASSWORD is set and strong
if grep -q "ADMIN_PASSWORD=YourSecurePassword123" .env; then
    echo -e "${RED}✗ ADMIN_PASSWORD is not set to a strong password${NC}"
    exit 1
fi

if grep -q "ADMIN_PASSWORD=changeme" .env; then
    echo -e "${RED}✗ ADMIN_PASSWORD is set to default 'changeme'${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Environment configuration looks good${NC}"

# 3. Create SSL certificates (if not exists)
echo -e "\n${YELLOW}[3/7] Checking SSL certificates...${NC}"
if [ ! -d \"certs\" ]; then
    mkdir -p certs
    echo -e \"${YELLOW}Creating self-signed certificate (use Let's Encrypt for production!)${NC}\"
    openssl req -x509 -newkey rsa:4096 -nodes -out certs/cert.pem -keyout certs/key.pem -days 365 \
        -subj \"/CN=upload.drilex.cz/O=drilex/C=CZ\"
fi
echo -e \"${GREEN}✓ SSL certificates ready${NC}\"

# 4. Create uploads directory with proper permissions
echo -e \"\n${YELLOW}[4/7] Setting up uploads directory...${NC}\"
mkdir -p uploads
chmod 755 uploads
echo -e \"${GREEN}✓ Uploads directory ready${NC}\"

# 5. Build Docker image
echo -e \"\n${YELLOW}[5/7] Building Docker image...${NC}\"
docker-compose build
echo -e \"${GREEN}✓ Docker image built${NC}\"

# 6. Stop existing containers
echo -e \"\n${YELLOW}[6/7] Stopping existing containers...${NC}\"
docker-compose down || true
echo -e \"${GREEN}✓ Old containers stopped${NC}\"

# 7. Start services
echo -e \"\n${YELLOW}[7/7] Starting services...${NC}\"
docker-compose up -d
echo -e \"${GREEN}✓ Services started${NC}\"

# Health check
echo -e \"\n${YELLOW}Waiting for health checks...${NC}\"
sleep 5
docker-compose ps

echo -e \"\n${GREEN}=== Deployment Complete ===${NC}\"
echo -e \"${GREEN}✓ UploadCDN is running!${NC}\"
echo -e \"\nAccess your application at: https://upload.drilex.cz\"
echo -e \"\nTo view logs: ${YELLOW}docker-compose logs -f${NC}\"
echo -e \"To stop services: ${YELLOW}docker-compose down${NC}\"
