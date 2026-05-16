import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { UPLOADS_DIR } from "@/lib/storage";

export async function GET(request, { params }) {
  const filename = params.slug?.join("/") || "";

  // Security: no path traversal
  if (filename.includes("..") || filename.startsWith("/")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const filepath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filepath) || !fs.statSync(filepath).isFile()) {
    return new NextResponse("File not found", { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filepath);
  const ext = path.extname(filename).toLowerCase();

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

  const contentType = mimeTypes[ext] || "application/octet-stream";

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
