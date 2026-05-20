import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  sanitizeInput,
  validateFilenameStrict,
  detectSuspiciousContent,
  validateRequestSize,
} from "@/lib/inputValidation";
import { isSymlink, getFileHash } from "@/lib/fileSystemSecurity";
import {
  checkAuth,
  UPLOADS_DIR,
  BASE_URL,
  ADMIN_PASSWORD,
} from "@/lib/storage";
import {
  validateFilePath,
  validateFileType,
  sanitizeFilenameSecurity,
  isFilenameBlacklisted,
  logSecurityEvent,
} from "@/lib/security";
import { createRateLimiter } from "@/lib/rateLimiter";

const uploadLimiter = createRateLimiter(1, 60000);
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * Enhanced POST endpoint for secure file uploads
 */
export async function POST(request) {
  // Rate limiting
  const rateLimitResult = uploadLimiter(request);
  if (rateLimitResult.limited) {
    logSecurityEvent("RATE_LIMIT_EXCEEDED_UPLOAD", {
      ip: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json(
      { error: "Too many upload requests" },
      {
        status: 429,
        headers: { "Retry-After": rateLimitResult.retryAfter },
      }
    );
  }

  // Authentication
  if (!checkAuth(request)) {
    logSecurityEvent("UNAUTHORIZED_UPLOAD", {
      ip: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Validate request size first
    const contentLength = parseInt(request.headers.get("content-length") || "0");
    const sizeValidation = validateRequestSize(contentLength, MAX_FILE_SIZE);
    if (!sizeValidation.valid) {
      return NextResponse.json(
        { error: sizeValidation.error },
        { status: 413 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const customName = formData.get("filename");

    // Validate file exists
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      logSecurityEvent("FILE_EXCEEDS_MAX_SIZE", {
        filename: file.name,
        size: file.size,
        maxSize: MAX_FILE_SIZE,
      });
      return NextResponse.json(
        { error: "File too large" },
        { status: 413 }
      );
    }

    // Validate MIME type
    if (!validateFileType(file.type, file.name)) {
      logSecurityEvent("BLOCKED_FILE_TYPE", {
        filename: file.name,
        mimeType: file.type,
      });
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    // Sanitize filename with strict validation
    const originalName = sanitizeInput(file.name || "upload");
    const filename = sanitizeFilenameSecurity(
      customName && customName.trim() ? sanitizeInput(customName.trim()) : originalName
    );

    if (!filename) {
      return NextResponse.json(
        { error: "Invalid filename" },
        { status: 400 }
      );
    }

    // Strict filename format validation
    const filenameValidation = validateFilenameStrict(filename);
    if (!filenameValidation.valid) {
      logSecurityEvent("INVALID_FILENAME_FORMAT", {
        filename,
        reason: filenameValidation.reason,
      });
      return NextResponse.json(
        { error: "Invalid filename format" },
        { status: 400 }
      );
    }

    // Blacklist check
    if (isFilenameBlacklisted(filename)) {
      logSecurityEvent("BLACKLISTED_FILENAME_UPLOAD", {
        filename,
      });
      return NextResponse.json(
        { error: "Invalid filename" },
        { status: 400 }
      );
    }

    // Path traversal protection
    const filepath = path.join(UPLOADS_DIR, filename);
    if (!validateFilePath(filepath, UPLOADS_DIR)) {
      logSecurityEvent("PATH_TRAVERSAL_UPLOAD", {
        attemptedPath: filepath,
      });
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    // Check for symlink attempts
    if (fs.existsSync(filepath) && isSymlink(filepath)) {
      logSecurityEvent("SYMLINK_UPLOAD_ATTEMPT", { filepath });
      return NextResponse.json(
        { error: "File already exists" },
        { status: 409 }
      );
    }

    // Check if file already exists
    if (fs.existsSync(filepath)) {
      return NextResponse.json(
        { error: "File already exists" },
        { status: 409 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Detect suspicious file content
    const contentCheck = detectSuspiciousContent(buffer, filename);
    if (contentCheck.suspicious) {
      logSecurityEvent("SUSPICIOUS_FILE_CONTENT", {
        filename,
        type: contentCheck.type,
      });
      return NextResponse.json(
        { error: "File content not allowed" },
        { status: 400 }
      );
    }

    // Write file securely
    fs.writeFileSync(filepath, buffer, { mode: 0o644 });

    // Verify file was written
    if (!fs.existsSync(filepath)) {
      throw new Error("File write verification failed");
    }

    // Calculate file hash
    const fileHash = getFileHash(filepath, "sha256");

    logSecurityEvent("FILE_UPLOADED_SECURE", {
      filename,
      size: buffer.length,
      mimeType: file.type,
      hash: fileHash,
    });

    return NextResponse.json({
      success: true,
      filename,
      url: `${BASE_URL}/${filename}`,
      size: buffer.length,
      hash: fileHash,
    });
  } catch (error) {
    logSecurityEvent("UPLOAD_ERROR", {
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
