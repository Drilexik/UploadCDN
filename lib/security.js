import path from "path";
import fs from "fs";

/**
 * Validate that a file path is within the allowed directory
 * Prevents path traversal attacks
 */
export function validateFilePath(filePath, baseDir) {
  const resolvedPath = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);
  
  // Check if resolved path is within base directory
  if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
    return false;
  }
  return true;
}

/**
 * Validate file type against whitelist
 * Prevents malicious file uploads
 */
const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Documents
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Archives
  "application/zip",
  "application/x-rar-compressed",
  "application/gzip",
  "application/x-7z-compressed",
  // Video
  "video/mp4",
  "video/webm",
  "video/mpeg",
  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
]);

const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "pif", "scr",
  "vbs", "js", "jar", "zip", "rar", "7z",
  "sh", "bash", "ps1", "msi", "dll", "so",
  "app", "deb", "rpm", "apk", "dmg",
]);

export function validateFileType(mimeType, filename) {
  // Check by MIME type
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return false;
  }
  
  // Check by extension
  const ext = filename.split(".").pop()?.toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return false;
  }
  
  return true;
}

/**
 * Sanitize filename with additional security checks
 */
export function sanitizeFilenameSecurity(name) {
  // Remove non-alphanumeric except . - _
  let sanitized = name.replace(/[^a-zA-Z0-9._-]/g, "");
  
  // Remove multiple dots to prevent extension tricks
  sanitized = sanitized.replace(/\.{2,}/g, ".");
  
  // Limit length to prevent issues
  sanitized = sanitized.substring(0, 255);
  
  // Ensure it's not empty
  if (!sanitized || sanitized === "." || sanitized === "..") {
    return null;
  }
  
  return sanitized;
}

/**
 * Check for suspicious filenames
 */
export function isFilenameBlacklisted(filename) {
  const suspicious = [
    ".env", ".env.local", ".env.production", ".env.development",
    ".git", ".aws", ".ssh", ".docker", "config.json",
    "credentials", "password", "secret", "token",
    "server.js", "next.config.js", "package.json",
  ];
  
  const lowerFilename = filename.toLowerCase();
  return suspicious.some(item => lowerFilename.includes(item.toLowerCase()));
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password) {
  if (!password || password.length < 16) {
    return false;
  }
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
}

/**
 * Log security events
 */
export function logSecurityEvent(eventType, details) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    eventType,
    ...details,
  };
  
  console.error(`[SECURITY] ${JSON.stringify(logEntry)}`);
  
  // In production, send to security logging service
  // e.g., Sentry, LogRocket, CloudWatch, etc.
}
