# Security Guide - UploadCDN

## 🔒 Security Features Implemented

### 1. **Path Traversal Protection**
- All file paths are validated to ensure they remain within the `UPLOADS_DIR`
- Uses `path.resolve()` to prevent symbolic link attacks
- Sanitizes filenames on both input and path handling

### 2. **Authentication & Authorization**
- Header-based authentication using `x-admin-password`
- Constant-time password comparison prevents timing attacks
- Mandatory strong password enforcement on startup
- Minimum 16-character password requirement

### 3. **Rate Limiting**
- Upload endpoint: 1 request per minute
- File listing: 10 requests per minute
- File operations (delete/rename): 5 requests per minute
- Prevents brute force and DoS attacks

### 4. **.env File Protection**
- `.env` file is in `.gitignore` and `.dockerignore`
- Never committed to repository
- Password validation on application startup
- Mandatory configuration prevents accidental deployment

### 5. **File Upload Security**
- MIME type whitelist validation
- File extension blacklist for dangerous types (exe, bat, sh, etc.)
- 100MB file size limit
- Filename sanitization to prevent injection attacks
- Blacklist of sensitive filenames (.env, .git, credentials, etc.)

### 6. **Security Headers**
- X-Content-Type-Options: nosniff (prevents MIME sniffing)
- X-Frame-Options: DENY (clickjacking protection)
- X-XSS-Protection: 1; mode=block (XSS protection)
- Content-Security-Policy (CSP) for additional protection
- Strict-Transport-Security (HSTS) for HTTPS enforcement
- Referrer-Policy: strict-origin-when-cross-origin

### 7. **Docker Security**
- Non-root user (nextjs) runs the application
- Secure file permissions (755 for directories)
- Health checks enabled
- Minimal Alpine Linux image

### 8. **Error Handling**
- Generic error messages to prevent information leakage
- Detailed logging for security events
- No stack traces exposed to clients
- Structured JSON logging for monitoring

### 9. **Cache Control**
- API endpoints disable caching to prevent data exposure
- Cache-Control headers prevent proxy caching

### 10. **Security Logging**
All security-relevant events are logged:
- Unauthorized access attempts
- Rate limit exceeded
- File upload attempts
- Path traversal attempts
- Invalid file types
- Password validation failures

## 📋 Deployment Checklist

### Before Deployment:

1. **Set Strong Password**
   ```bash
   export ADMIN_PASSWORD="YourSecurePassword123!@#"
   # Must have: uppercase, lowercase, numbers, special chars
   # Minimum: 16 characters
   ```

2. **HTTPS Configuration**
   - Use a reverse proxy (nginx, Caddy)
   - Set BASE_URL to https://your-domain.com
   - Enable HSTS in production

3. **Docker Security**
   ```bash
   # Build image
   docker build -t uploadcdn:latest .
   
   # Run with security options
   docker run \
     -e ADMIN_PASSWORD="YourPassword123!@#" \
     -e BASE_URL="https://your-domain.com" \
     --read-only \
     --cap-drop=ALL \
     --security-opt=no-new-privileges:true \
     -v /var/uploads:/app/uploads \
     uploadcdn:latest
   ```

4. **Firewall Rules**
   - Only expose ports 80/443 (via reverse proxy)
   - Limit API access by IP if possible
   - Use Web Application Firewall (WAF) rules

5. **Monitoring**
   - Monitor security logs for suspicious activity
   - Set up alerts for failed auth attempts
   - Track unusual file uploads
   - Monitor error rates

### Runtime Security:

1. **Regular Updates**
   - Keep Node.js updated
   - Update dependencies regularly: `npm audit`
   - Apply security patches immediately

2. **Backup Strategy**
   - Regular backups of uploads directory
   - Version control for configuration
   - Disaster recovery plan

3. **Log Rotation**
   - Implement log rotation for security logs
   - Archive logs for compliance
   - Monitor log storage usage

4. **Access Control**
   - Change ADMIN_PASSWORD regularly
   - Use different passwords for different environments
   - Implement multi-factor authentication if possible

## 🚨 Security Incidents

If you suspect a security breach:

1. **Immediate Actions:**
   - Change ADMIN_PASSWORD immediately
   - Review security logs for suspicious activity
   - Check uploaded files for malware
   - Rotate all credentials

2. **Investigation:**
   - Check logs for unauthorized access patterns
   - Review file uploads for suspicious content
   - Check for modified/deleted files
   - Review network logs

3. **Recovery:**
   - Remove compromised files
   - Restore from clean backup if necessary
   - Update all passwords
   - Deploy security patches

## 📚 References

- [OWASP Top 10](https://owasp.org/Top10/)
- [CWE-22: Improper Limitation of a Pathname to a Restricted Directory](https://cwe.mitre.org/data/definitions/22.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)

## ⚠️ Known Limitations

1. **In-Memory Rate Limiting**: Consider using Redis in production for distributed rate limiting
2. **Malware Scanning**: For production use, integrate with antivirus APIs (ClamAV, VirusTotal)
3. **Distributed Deployments**: Implement shared logging and monitoring across instances
4. **Audit Trails**: Implement persistent audit logging for compliance

## 🔐 Future Enhancements

- [ ] Implement Redis for distributed rate limiting
- [ ] Add antivirus scanning (ClamAV, VirusTotal API)
- [ ] Implement OAuth2/OIDC authentication
- [ ] Add file integrity checking (SHA256 hashes)
- [ ] Implement audit logging to persistent storage
- [ ] Add IP whitelisting
- [ ] Implement file encryption at rest
- [ ] Add DLP (Data Loss Prevention) checks
