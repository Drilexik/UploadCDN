# 🔐 Complete Security Hardening Configuration

## Environment Configuration

```bash
# .env - Vyplňte a bezpečně ulož te
ADMIN_PASSWORD=GeneratedStrongPassword123!@#$%^&*()
BASE_URL=https://cdn.example.com
NODE_ENV=production
PORT=3000
UPLOADS_DIR=/app/uploads

# Security settings
ENABLE_ADVANCED_SECURITY=true
ENABLE_ATTACK_DETECTION=true
ENABLE_FILE_INTEGRITY=true
ENABLE_REQUEST_MONITORING=true
MAX_FILE_SIZE=104857600
MAX_REQUEST_SIZE=104857600
SESSION_TIMEOUT=3600000
RATE_LIMIT_WINDOW=60000
```

---

## nginx Configuration with Advanced Security

```nginx
# nginx.conf - Security hardened version

upstream backend {
    server uploadcdn:3000;
    keepalive 32;
}

# Limit zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=upload_limit:10m rate=1r/m;
limit_conn_zone $binary_remote_addr zone=addr:10m;

# Main configuration
server {
    listen 443 ssl http2;
    server_name cdn.example.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;
    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:" always;

    # Client restrictions
    client_max_body_size 100M;
    client_body_timeout 60s;
    client_header_timeout 60s;
    keepalive_timeout 60s;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css text/xml text/javascript application/json;
    gzip_min_length 1000;

    # Deny suspicious requests
    if ($request_method !~ ^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$) {
        return 444;
    }

    location /api/upload {
        limit_req zone=upload_limit burst=1 nodelay;
        limit_conn addr 1;
        
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /api/ {
        limit_req zone=api_limit burst=10 nodelay;
        
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Connection "upgrade";
    }

    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Connection "upgrade";
    }

    # Logging
    access_log /var/log/nginx/access.log combined;
    error_log /var/log/nginx/error.log warn;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name cdn.example.com;
    return 301 https://$server_name$request_uri;
}
```

---

## Docker Compose with Advanced Security

```yaml
version: '3.8'

services:
  uploadcdn:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: uploadcdn-secure
    restart: unless-stopped
    
    # Advanced security
    read_only: true
    tmpfs:
      - /tmp
      - /app/.next
    
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    
    security_opt:
      - no-new-privileges:true
    
    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '1'
          memory: 512M
    
    # Environment
    environment:
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - BASE_URL=${BASE_URL}
      - NODE_ENV=production
      - PORT=3000
      - UPLOADS_DIR=/app/uploads
      - ENABLE_ADVANCED_SECURITY=true
      - ENABLE_ATTACK_DETECTION=true
    
    volumes:
      - ./uploads:/app/uploads:rw
    
    ports:
      - "127.0.0.1:3000:3000"
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
        labels: "service=uploadcdn"

  nginx:
    image: nginx:alpine
    container_name: uploadcdn-nginx
    restart: unless-stopped
    
    ports:
      - "80:80"
      - "443:443"
    
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    
    depends_on:
      - uploadcdn
    
    security_opt:
      - no-new-privileges:true
    
    read_only: true
    tmpfs:
      - /var/cache/nginx
      - /var/run
    
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
        labels: "service=nginx"
```

---

## Firewall Configuration (UFW)

```bash
#!/bin/bash
# firewall-setup.sh

sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Rate limiting on SSH
sudo ufw limit 22/tcp

# Enable
sudo ufw enable

# Verify
sudo ufw status verbose
```

---

## Fail2Ban Configuration

```ini
# /etc/fail2ban/jail.local

[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = true
port = http,https
filter = nginx-noscript
logpath = /var/log/nginx/access.log

[nginx-badbots]
enabled = true
port = http,https
filter = nginx-badbots
logpath = /var/log/nginx/access.log

[nginx-noproxy]
enabled = true
port = http,https
filter = nginx-noproxy
logpath = /var/log/nginx/access.log

[nginx-limit-req]
enabled = true
port = http,https
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
```

---

## SSL/TLS Setup Script

```bash
#!/bin/bash
# ssl-setup.sh

# Option 1: Let's Encrypt
certbot certonly --standalone -d cdn.example.com
cp /etc/letsencrypt/live/cdn.example.com/fullchain.pem certs/cert.pem
cp /etc/letsencrypt/live/cdn.example.com/privkey.pem certs/key.pem

# Auto-renewal cron
echo "0 3 * * * certbot renew --quiet" | crontab -

# Option 2: Self-signed (testing only)
# openssl req -x509 -newkey rsa:4096 -nodes \
#   -out certs/cert.pem -keyout certs/key.pem -days 365 \
#   -subj "/CN=cdn.example.com"
```

---

## Monitoring & Alerting

```bash
#!/bin/bash
# monitor.sh

echo "=== Security Monitoring ==="

# Check container status
echo "Container Status:"
docker-compose ps

# Check resource usage
echo "\nResource Usage:"
docker stats --no-stream

# Check recent security events
echo "\nRecent Security Events:"
docker-compose logs --tail=50 uploadcdn | grep -i "security\|attack\|unauthorized"

# Check error count
echo "\nError Count:"
docker-compose logs --tail=1000 uploadcdn | grep -c "ERROR"

# Check rate limit triggers
echo "\nRate Limit Triggers:"
docker-compose logs --tail=1000 uploadcdn | grep -c "RATE_LIMIT"

# Disk usage
echo "\nDisk Usage:"
du -sh uploads/
df -h /

# Check file integrity (if available)
echo "\nFile Integrity:"
aide --check || echo "AIDE not configured"
```

---

**Tato konfigurace zajišťuje maximální bezpečnost vaší aplikace! ✅**
