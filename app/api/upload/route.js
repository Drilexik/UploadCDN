import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { UPLOADS_DIR, BASE_URL } from "@/lib/storage";
import { enforceAuth } from "@/lib/auth";
import {
  validateFilePath,
  validateFileType,
  sanitizeFilenameSecurity,
  isFilenameBlacklisted,
  logSecurityEvent,
} from "@/lib/security";
import {
  sanitizeInput,
  validateFilenameStrict,
  detectSuspiciousContent,
} from "@/lib/inputValidation";
import { isSymlink } from "@/lib/fileSystemSecurity";
import { createRateLimiter } from "@/lib/rateLimiter";
import { getClientIp } from "@/lib/clientIp";

// 1 request per minute for upload
const uploadLimiter = createRateLimiter(1, 60000);

// Max 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function POST(request) {
  const ip = getClientIp(request);

  // Rate limiting
  const rateLimitResult = uploadLimiter(request);
  if (rateLimitResult.limited) {
    logSecurityEvent("RATE_LIMIT_EXCEEDED", { endpoint: "/api/upload", ip });
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfter) } }
    );
  }

  // Authentication + brute-force lockout
  const auth = enforceAuth(request, "/api/upload");
  if (!auth.ok) return auth.response;

  try {
    // Early reject on declared size (nginx also caps the body). Allow a small
    // margin over MAX_FILE_SIZE for multipart boundary overhead.
    const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_FILE_SIZE + 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 413 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const customName = formData.get("filename");

    // Validate file exists
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate actual file size
    if (file.size > MAX_FILE_SIZE) {
      logSecurityEvent("FILE_TOO_LARGE", { filename: file.name, size: file.size, maxSize: MAX_FILE_SIZE });
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 413 }
      );
    }

    // Validate MIME type / extension
    if (!validateFileType(file.type, file.name)) {
      logSecurityEvent("INVALID_FILE_TYPE", { filename: file.name, mimeType: file.type });
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }

    // Sanitize filename
    const originalName = sanitizeInput(file.name || "upload");
    const filename = sanitizeFilenameSecurity(
      customName && customName.trim() ? sanitizeInput(customName.trim()) : originalName
    );

    if (!filename) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    // Strict filename format validation (defense-in-depth)
    const filenameValidation = validateFilenameStrict(filename);
    if (!filenameValidation.valid) {
      logSecurityEvent("INVALID_FILENAME_FORMAT", { filename, reason: filenameValidation.reason });
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    // Blacklist check
    if (isFilenameBlacklisted(filename)) {
      logSecurityEvent("BLACKLISTED_FILENAME", { filename, ip });
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    // Path traversal protection
    const filepath = path.join(UPLOADS_DIR, filename);
    if (!validateFilePath(filepath, UPLOADS_DIR)) {
      logSecurityEvent("PATH_TRAVERSAL_ATTEMPT", { attemptedPath: filepath, ip });
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    // Reject writing through an existing symlink
    if (fs.existsSync(filepath) && isSymlink(filepath)) {
      logSecurityEvent("SYMLINK_UPLOAD_ATTEMPT", { filepath, ip });
      return NextResponse.json({ error: "File already exists" }, { status: 409 });
    }

    // Check if file already exists
    if (fs.existsSync(filepath)) {
      return NextResponse.json({ error: "File already exists" }, { status: 409 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Reject disguised executables / scripts by magic-byte header
    const contentCheck = detectSuspiciousContent(buffer, filename);
    if (contentCheck.suspicious) {
      logSecurityEvent("SUSPICIOUS_FILE_CONTENT", { filename, type: contentCheck.type, ip });
      return NextResponse.json({ error: "File content not allowed" }, { status: 400 });
    }

    // Write file with secure permissions
    fs.writeFileSync(filepath, buffer, { mode: 0o644 });

    logSecurityEvent("FILE_UPLOADED", { filename, size: buffer.length, mimeType: file.type });

    return NextResponse.json({
      success: true,
      filename,
      url: `${BASE_URL}/${filename}`,
      size: buffer.length,
    });
  } catch (e) {
    logSecurityEvent("UPLOAD_ERROR", { error: e.message });
    // Don't expose error details to client
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
}
