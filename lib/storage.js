import fs from "fs";
import path from "path";

export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
export const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";

// Ensure uploads dir exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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

export function checkAuth(request) {
  const pw = request.headers.get("x-admin-password");
  return pw === ADMIN_PASSWORD;
}
