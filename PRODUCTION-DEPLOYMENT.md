# Production Deployment Guide - UploadCDN

## 🚀 Quick Start

### Prerequisites
- VPS with Ubuntu 20.04+ or similar Linux distribution
- SSH access to VPS
- Minimum 2GB RAM, 1GB storage for application + uploads
- Domain name (for SSL/TLS)

### Step 1: Clone Repository
```bash
ssh user@your-vps-ip
git clone https://github.com/yourusername/uploadcdn.git
cd uploadcdn
```

### Step 2: Configure Environment
```bash
cp .env.example .env
nano .env
```

**CRITICAL**: Generate a strong ADMIN_PASSWORD
```bash
# Example (generate a new random password):
openssl rand -base64 32
# Output: abc123def456ghi789jkl000mno111pqr222stu
```

Edit `.env`:
```
ADMIN_PASSWORD=abc123def456ghi789jkl000mno111pqr222stu
BASE_URL=https://your-domain.com
```

### Step 3: Run Security Checklist
```bash
bash CHECKLIST.md
```

All checks must pass before proceeding.

### Step 4: Deploy
```bash
bash deploy.sh
```

### Step 5: Verify Deployment
```bash
docker-compose ps
curl https://localhost/api/files -H "x-admin-password: abc123def456ghi789jkl000mno111pqr222stu"
```

## 🔒 Security Configuration

### Firewall Setup
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### SSL/TLS Certificate Setup

#### Option 1: Let's Encrypt (Recommended)
```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy to certs directory
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem certs/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem certs/key.pem
sudo chown $USER:$USER certs/*
```

#### Option 2: Self-Signed (Testing Only)
```bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -nodes \
    -out certs/cert.pem -keyout certs/key.pem -days 365 \
    -subj "/CN=your-domain.com/O=YourOrg/C=CZ"
```

### Application Hardening
```bash
bash hardening.sh
```

This will:
- Update system packages
- Configure firewall rules
- Setup Fail2Ban (rate limiting)
- Enable file integrity monitoring
- Setup automated security monitoring

## 🔍 Regular Maintenance

### Daily
```bash
# Check logs for security events
docker-compose logs -f

# Monitor disk space
df -h
```

### Weekly
```bash
# Run security audit
bash security-audit.sh

# Check for updates
sudo apt update && sudo apt list --upgradable
```

### Monthly
```bash
# Update packages
sudo apt upgrade -y
docker pull node:20-alpine
docker pull nginx:alpine
docker-compose build --no-cache

# Check file integrity
aide --check

# Review and rotate logs
docker-compose logs --tail=1000 > logs/$(date +%Y%m%d).log
```

### Every 3 Months
```bash
# Update dependencies
npm update
npm audit

# Renew SSL certificate (if using Let's Encrypt)
sudo certbot renew --dry-run
```

## 🚨 Security Monitoring

### Set Up Log Aggregation
```bash
# View real-time logs
docker-compose logs -f uploadcdn

# Monitor security events
docker-compose logs uploadcdn | grep -i "security\|error\|unauthorized"
```

### Key Events to Monitor
- `UNAUTHORIZED_*` - Failed authentication attempts
- `RATE_LIMIT_EXCEEDED` - Rate limiting triggered
- `PATH_TRAVERSAL_ATTEMPT` - Malicious path requests
- `INVALID_FILE_TYPE` - Unsupported file uploads
- `FILE_ERROR` - File operation errors

### Setup Email Alerts (Optional)
```bash
# Install mail utilities
sudo apt-get install -y mailutils

# Add cron job for alerts
crontab -e

# Add: 0 * * * * docker-compose logs uploadcdn | grep "UNAUTHORIZED\|ERROR" | mail -s "UploadCDN Security Alert" admin@example.com
```

## 📊 Backup Strategy

### Automatic Backups
```bash
#!/bin/bash
# backup.sh - Daily backup script

BACKUP_DIR="/var/backups/uploadcdn"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz uploads/

# Keep only last 7 days
find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/uploads_$DATE.tar.gz"
```

Add to crontab:
```bash
0 2 * * * /path/to/backup.sh
```

### Remote Backup
```bash
# Using rsync to remote server
rsync -avz --delete uploads/ user@backup-server:/backups/uploadcdn/

# Or using s3cmd to AWS S3
s3cmd sync uploads/ s3://your-backup-bucket/uploadcdn/
```

## 🔐 Disaster Recovery

### Restore from Backup
```bash
# Stop services
docker-compose down

# Restore uploads
tar -xzf /var/backups/uploadcdn/uploads_YYYYMMDD_HHMMSS.tar.gz

# Start services
docker-compose up -d
```

### Rebuild Application
```bash
# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## ⚙️ Advanced Configuration

### Configure Resource Limits
Edit `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 1G
    reservations:
      cpus: '1'
      memory: 512M
```

### Configure Multiple Instances (Load Balancing)
```yaml
# docker-compose.yml
services:
  uploadcdn:
    # ... existing config
    deploy:
      replicas: 3
```

### Database Integration (Optional)
For production with database logging:
```bash
# Add PostgreSQL to docker-compose.yml
# Store file metadata and access logs
```

## 🆘 Troubleshooting

### Application won't start
```bash
docker-compose logs uploadcdn
# Check for ADMIN_PASSWORD or BASE_URL issues
```

### Out of disk space
```bash
du -sh uploads/
# Clean old files or extend storage
```

### High memory usage
```bash
docker stats
# Reduce file upload limit or add worker processes
```

### SSL certificate issues
```bash
# Check certificate validity
openssl x509 -in certs/cert.pem -text -noout

# Renew if needed
sudo certbot renew --force-renewal
```

## 📞 Support

For security issues:
1. Do not publish vulnerabilities publicly
2. Email: security@example.com
3. Include details and proof of concept

For other issues:
- Check SECURITY.md for security policies
- Review logs with `docker-compose logs`
- Run `security-audit.sh` to check configuration

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/Top10/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Let's Encrypt](https://letsencrypt.org/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
