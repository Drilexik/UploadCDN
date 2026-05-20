#!/bin/bash

# Security hardening and monitoring for UploadCDN

echo "=== UploadCDN Security Hardening ==="

# 1. System-level security
echo "[1] Applying system-level security..."

# Update system
apt-get update && apt-get upgrade -y

# Install security tools
apt-get install -y fail2ban ufw aide

# 2. Firewall configuration
echo "[2] Configuring firewall..."

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable

# 3. Fail2Ban configuration for rate limiting
echo "[3] Configuring Fail2Ban..."

cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
port = http,https
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
EOF

systemctl restart fail2ban

# 4. File integrity monitoring
echo "[4] Setting up file integrity monitoring..."

aide --init
mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db

# 5. Log rotation
echo "[5] Configuring log rotation..."

cat > /etc/logrotate.d/uploadcdn << EOF
/var/log/uploadcdn/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
}
EOF

# 6. Security monitoring script
echo "[6] Creating security monitoring script..."

cat > /usr/local/bin/monitor-uploadcdn.sh << 'EOF'
#!/bin/bash

# Monitor security-related events
DOCKER_LOGS=$(docker-compose logs --tail=100 uploadcdn 2>/dev/null)

echo "=== Security Event Monitoring ==="
echo "Unauthorized Access Attempts:"
echo "$DOCKER_LOGS" | grep -i "unauthorized" | tail -10

echo ""
echo "Rate Limit Exceeded:"
echo "$DOCKER_LOGS" | grep -i "rate_limit" | tail -10

echo ""
echo "Path Traversal Attempts:"
echo "$DOCKER_LOGS" | grep -i "path_traversal" | tail -10

echo ""
echo "Invalid File Types:"
echo "$DOCKER_LOGS" | grep -i "invalid_file_type" | tail -10

echo ""
echo "File Operations:"
echo "$DOCKER_LOGS" | grep -i "file_" | tail -10
EOF

chmod +x /usr/local/bin/monitor-uploadcdn.sh

# 7. Scheduled security checks
echo "[7] Setting up scheduled security checks..."

# Add to crontab
(crontab -l 2>/dev/null; echo "0 * * * * aide --check | mail -s 'Aide Report' root") | crontab -

# 8. SELinux/AppArmor setup (if available)
echo "[8] Checking for SELinux/AppArmor..."

if command -v getenforce &> /dev/null; then
    echo "SELinux is available - ensure it's configured for Docker containers"
fi

if command -v aa-status &> /dev/null; then
    echo "AppArmor is available - ensure it's configured for Docker containers"
fi

echo ""
echo "=== Security Hardening Complete ==="
echo "Run 'monitor-uploadcdn.sh' to check security events"
echo "Run 'aide --check' to verify file integrity"
