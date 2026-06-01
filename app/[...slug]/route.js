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

// Raster formats jimp can decode/encode for on-the-fly resizing.
const RESIZABLE = new Set([".png", ".jpg", ".jpeg", ".gif", ".bmp"]);
const MAX_DIM = 2048;            // clamp requested width/height
const MAX_RESIZE_SOURCE = 20 * 1024 * 1024; // don't resize sources larger than 20MB

// Parse ?size=600x600 | 600;600 | 600,600 | 600 (square), or ?w=&h=.
// Returns { w, h } (either may be undefined) or null if no resize requested.
function parseSize(searchParams) {
  let w, h;
  const size = searchParams.get("size");
  if (size) {
    const parts = size.split(/[x;,*X]/).map((s) => parseInt(s, 10));
    if (parts.length === 1) {
      w = h = parts[0];
    } else {
      w = parts[0];
      h = parts[1];
    }
  }
  const qw = searchParams.get("w");
  const qh = searchParams.get("h");
  if (qw !== null) w = parseInt(qw, 10);
  if (qh !== null) h = parseInt(qh, 10);
  const clamp = (v) => (Number.isInteger(v) && v > 0 ? Math.min(v, MAX_DIM) : undefined);
  w = clamp(w);
  h = clamp(h);
  if (!w && !h) return null;
  return { w, h };
}

// Resize with jimp. Defensive: any failure (lib missing, decode error, …)
// returns null so the caller serves the original untouched.
async function resizeImage(buffer, ext, dims) {
  try {
    const { Jimp } = await import("jimp");
    const img = await Jimp.read(buffer);
    let { w, h } = dims;
    const aspect = img.bitmap.height / img.bitmap.width;
    if (w && !h) h = Math.max(1, Math.round(w * aspect));
    if (h && !w) w = Math.max(1, Math.round(h / aspect));
    img.resize({ w, h });
    const mime =
      ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
      ext === ".gif" ? "image/gif" :
      ext === ".bmp" ? "image/bmp" :
      "image/png";
    return { buffer: await img.getBuffer(mime), contentType: mime };
  } catch {
    return null;
  }
}

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

  let fileBuffer = fs.readFileSync(filepath);
  const ext = path.extname(filename).toLowerCase();
  let contentType = mimeTypes[ext] || "application/octet-stream";

  // Optional on-the-fly resize for raster images: /pic.png?size=600x600
  // (also accepts ?w= / ?h=). Silently no-ops on unsupported/oversized files.
  if (RESIZABLE.has(ext) && fileBuffer.length <= MAX_RESIZE_SOURCE) {
    const dims = parseSize(new URL(request.url).searchParams);
    if (dims) {
      const resized = await resizeImage(fileBuffer, ext, dims);
      if (resized) {
        fileBuffer = resized.buffer;
        contentType = resized.contentType;
      }
    }
  }

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
