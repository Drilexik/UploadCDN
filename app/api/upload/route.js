import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
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

// 1 request per minute for upload
const uploadLimiter = createRateLimiter(1, 60000);

// Max 100MB (increased from 50MB for flexibility)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Minimum password length check
function validateAdminPassword() {
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD === "changeme") {
    logSecurityEvent("CRITICAL_SECURITY", {
      issue: "Default or missing ADMIN_PASSWORD",
      recommendation: "Set ADMIN_PASSWORD environment variable to a strong password",
    });
  }
}

validateAdminPassword();

export async function POST(request) {
  // Rate limiting
  const rateLimitResult = uploadLimiter(request);
  if (rateLimitResult.limited) {
    logSecurityEvent("RATE_LIMIT_EXCEEDED", {
      endpoint: "/api/upload",
      ip: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": rateLimitResult.retryAfter },
      }
    );
  }

  // Authentication
  if (!checkAuth(request)) {
    logSecurityEvent("UNAUTHORIZED_UPLOAD_ATTEMPT", {
      endpoint: "/api/upload",
      ip: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
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
      logSecurityEvent("FILE_TOO_LARGE", {
        filename: file.name,
        size: file.size,
        maxSize: MAX_FILE_SIZE,
      });
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!validateFileType(file.type, file.name)) {
      logSecurityEvent("INVALID_FILE_TYPE", {
        filename: file.name,
        mimeType: file.type,
      });
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    // Sanitize filename
    const originalName = file.name || "upload";
    const filename = sanitizeFilenameSecurity(
      customName && customName.trim() ? customName.trim() : originalName
    );

    if (!filename) {
      return NextResponse.json(
        { error: "Invalid filename" },
        { status: 400 }
      );
    }

    // Blacklist check
    if (isFilenameBlacklisted(filename)) {
      logSecurityEvent("BLACKLISTED_FILENAME", {
        filename,
        ip: request.headers.get("x-forwarded-for"),
      });
      return NextResponse.json(
        { error: "Invalid filename" },
        { status: 400 }
      );
    }

    // Path traversal protection
    const filepath = path.join(UPLOADS_DIR, filename);
    if (!validateFilePath(filepath, UPLOADS_DIR)) {
      logSecurityEvent("PATH_TRAVERSAL_ATTEMPT", {
        attemptedPath: filepath,
        ip: request.headers.get("x-forwarded-for"),
      });
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    // Check if file already exists
    if (fs.existsSync(filepath)) {
      return NextResponse.json(
        { error: "File already exists" },
        { status: 409 }
      );
    }

    // Write file with secure permissions
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer, { mode: 0o644 });

    logSecurityEvent("FILE_UPLOADED", {
      filename,
      size: buffer.length,
      mimeType: file.type,
    });

    return NextResponse.json({
      success: true,
      filename,
      url: `${BASE_URL}/${filename}`,
      size: buffer.length,
    });
  } catch (e) {
    logSecurityEvent("UPLOAD_ERROR", {
      error: e.message,
      stack: e.stack,
    });
    // Don't expose error details to client
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
}
