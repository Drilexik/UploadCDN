import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { UPLOADS_DIR } from "@/lib/storage";
import { validateFilePath, logSecurityEvent } from "@/lib/security";
import { isSymlink } from "@/lib/fileSystemSecurity";

const mimeTypes = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".avif": "image/avif",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".json": "application/json",
  ".txt": "text/plain",
  ".css": "text/css",
  ".js": "application/javascript",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".zip": "application/zip",
};

// Content types that a browser may execute scripts from when opened directly
// (top-level navigation). Served with a locked-down CSP + sandbox so any
// embedded <script> (e.g. inside an SVG or HTML file) cannot run in our origin.
const ACTIVE_TYPES = new Set([
  ".svg",
  ".html",
  ".htm",
  ".xml",
  ".xhtml",
]);

export async function GET(request, { params }) {
  const filename = params.slug?.join("/") || "";

  // Fast structural rejects.
  if (!filename || filename.includes("..") || filename.startsWith("/") || filename.includes("\0")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const filepath = path.join(UPLOADS_DIR, filename);

  // Canonical path-traversal guard (also blocks backslash/encoded escapes).
  if (!validateFilePath(filepath, UPLOADS_DIR)) {
    logSecurityEvent("PATH_TRAVERSAL_ATTEMPT_SERVE", {
      attemptedPath: filepath,
      ip: request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for"),
    });
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Never follow symlinks out of the uploads directory.
  if (isSymlink(filepath)) {
    logSecurityEvent("SYMLINK_SERVE_ATTEMPT", { filepath });
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(filepath) || !fs.statSync(filepath).isFile()) {
    return new NextResponse("File not found", { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filepath);
  const ext = path.extname(filename).toLowerCase();
  const contentType = mimeTypes[ext] || "application/octet-stream";

  const headers = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Access-Control-Allow-Origin": "*",
    // Stop browsers from MIME-sniffing a benign type into an executable one.
    "X-Content-Type-Options": "nosniff",
  };

  // Neutralise stored-XSS via uploaded SVG/HTML/XML. The sandbox + null CSP
  // means scripts can't execute even if the file is opened as a top-level
  // document; SVGs embedded via <img> still render normally.
  if (ACTIVE_TYPES.has(ext) || contentType === "application/octet-stream") {
    headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
    // Force download for genuinely active document types (not images).
    if (ext === ".html" || ext === ".htm" || ext === ".xml" || ext === ".xhtml" || contentType === "application/octet-stream") {
      headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(path.basename(filename))}"`;
    }
  }

  return new NextResponse(fileBuffer, { status: 200, headers });
}
