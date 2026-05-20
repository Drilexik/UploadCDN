import fs from "fs";
import path from "path";
import crypto from "crypto";

export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
export const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Security check on startup
if (!ADMIN_PASSWORD) {
  console.error(
    "⚠️  CRITICAL: ADMIN_PASSWORD environment variable is not set!"
  );
  console.error("Set it to a strong password before starting the application.");
  process.exit(1);
}

if (ADMIN_PASSWORD === "changeme") {
  console.error(
    "⚠️  CRITICAL: ADMIN_PASSWORD is set to default value 'changeme'!"
  );
  console.error("Please set ADMIN_PASSWORD to a strong, unique password.");
  process.exit(1);
}

if (ADMIN_PASSWORD.length < 16) {
  console.error(
    "⚠️  WARNING: ADMIN_PASSWORD is too short (minimum 16 characters recommended)."
  );
}

// Ensure uploads dir exists with secure permissions
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true, mode: 0o755 });
}

// Set secure permissions on uploads directory
try {
  fs.chmodSync(UPLOADS_DIR, 0o755);
} catch (e) {
  console.warn("Could not set directory permissions:", e.message);
}

export function listFiles() {
  return fs
    .readdirSync(UPLOADS_DIR)
    .filter((name) => {
      try {
        return fs.statSync(path.join(UPLOADS_DIR, name)).isFile();
      } catch {
        return false;
      }
    })
    .map((name) => {
      const stat = fs.statSync(path.join(UPLOADS_DIR, name));
      return {
        filename: name,
        url: `${BASE_URL}/${name}`,
        size: stat.size,
        createdAt: stat.birthtime,
        mtime: stat.mtime,
      };
    })
    .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
}

export function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "").replace(/\.{2,}/g, "");
}

/**
 * Constant-time password comparison to prevent timing attacks
 */
function constantTimeCompare(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

export function checkAuth(request) {
  const pw = request.headers.get("x-admin-password");
  
  if (!pw) {
    return false;
  }
  
  // Use constant-time comparison to prevent timing attacks
  return constantTimeCompare(pw, ADMIN_PASSWORD);
}
