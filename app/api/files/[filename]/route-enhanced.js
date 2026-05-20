import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  sanitizeInput,
  validateFilenameStrict,
  detectSuspiciousContent,
} from "@/lib/inputValidation";
import {
  validateFileIntegrity,
  isSymlink,
  validateNoSymlinks,
} from "@/lib/fileSystemSecurity";
import {
  checkAuth,
  UPLOADS_DIR,
  BASE_URL,
} from "@/lib/storage";
import {
  validateFilePath,
  logSecurityEvent,
} from "@/lib/security";
import { createRateLimiter } from "@/lib/rateLimiter";

// Rate limiters
const downloadLimiter = createRateLimiter(30, 60000);

/**
 * GET /api/files/[filename] - Download file with security checks
 * DELETE /api/files/[filename] - Delete file
 * PATCH /api/files/[filename] - Rename file
 */

export async function GET(request, { params }) {
  // Rate limiting
  const rateLimitResult = downloadLimiter(request);
  if (rateLimitResult.limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": rateLimitResult.retryAfter },
      }
    );
  }

  try {
    const filename = sanitizeInput(params.filename);

    // Strict filename validation
    const validation = validateFilenameStrict(filename);
    if (!validation.valid) {
      logSecurityEvent("INVALID_FILENAME_FORMAT", {
        filename,
        reason: validation.reason,
        ip: request.headers.get("x-forwarded-for"),
      });
      return NextResponse.json(
        { error: "Invalid filename" },
        { status: 400 }
      );
    }

    const filepath = path.join(UPLOADS_DIR, filename);

    // Multiple path security checks
    if (!validateFilePath(filepath, UPLOADS_DIR)) {
      logSecurityEvent("PATH_TRAVERSAL_ATTEMPT_DOWNLOAD", {
        filepath,
        ip: request.headers.get("x-forwarded-for"),
      });
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 }
      );
    }

    // Check for symlinks
    if (isSymlink(filepath)) {
      logSecurityEvent("SYMLINK_ATTACK_ATTEMPT", {
        filepath,
        ip: request.headers.get("x-forwarded-for"),
      });
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    // Verify file exists and is readable
    if (!fs.existsSync(filepath)) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = fs.readFileSync(filepath);

    // Check file size is reasonable
    if (fileBuffer.length > 500 * 1024 * 1024) {
      // 500MB limit
      logSecurityEvent("FILE_SIZE_EXCEEDED", {
        filename,
        size: fileBuffer.length,
      });
      return NextResponse.json(
        { error: "File too large" },
        { status: 413 }
      );
    }

    // Get file info
    const stat = fs.statSync(filepath);
    const mimeType = getMimeType(filename);

    // Create response
    const response = new NextResponse(fileBuffer);
    response.headers.set("Content-Type", mimeType);
    response.headers.set(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    response.headers.set("Content-Length", fileBuffer.length);

    // Security headers
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Cache-Control", "no-cache, no-store");

    logSecurityEvent("FILE_DOWNLOADED", {
      filename,
      size: fileBuffer.length,
    });

    return response;
  } catch (error) {
    logSecurityEvent("DOWNLOAD_ERROR", {
      error: error.message,
    });
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}

/**
 * Delete with enhanced security
 */
export async function DELETE(request, { params }) {
  if (!checkAuth(request)) {
    logSecurityEvent("UNAUTHORIZED_DELETE", {
      ip: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const filename = sanitizeInput(params.filename);

    // Strict validation
    const validation = validateFilenameStrict(filename);
    if (!validation.valid) {
      logSecurityEvent("INVALID_DELETE_FILENAME", {
        filename,
        reason: validation.reason,
      });
      return NextResponse.json(
        { error: "Invalid filename" },
        { status: 400 }
      );
    }

    const filepath = path.join(UPLOADS_DIR, filename);

    // Path verification
    if (!validateFilePath(filepath, UPLOADS_DIR)) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 }
      );
    }

    // Symlink check
    if (fs.existsSync(filepath) && isSymlink(filepath)) {
      logSecurityEvent("SYMLINK_DELETE_ATTEMPT", { filepath });
      return NextResponse.json(
        { error: "Invalid file" },
        { status: 400 }
      );
    }

    // Check file exists
    if (!fs.existsSync(filepath)) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Delete file
    fs.unlinkSync(filepath);

    logSecurityEvent("FILE_DELETED_SECURE", {
      filename,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logSecurityEvent("DELETE_ERROR", {
      error: error.message,
    });
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}

/**
 * PATCH with enhanced security
 */
export async function PATCH(request, { params }) {
  if (!checkAuth(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    const oldName = sanitizeInput(params.filename);
    const newName = sanitizeInput(body.newFilename || "");

    // Strict validation for both names
    const oldValidation = validateFilenameStrict(oldName);
    const newValidation = validateFilenameStrict(newName);

    if (!oldValidation.valid || !newValidation.valid) {
      logSecurityEvent("INVALID_RENAME_FILENAME", {
        oldName,
        newName,
        oldReason: oldValidation.reason,
        newReason: newValidation.reason,
      });
      return NextResponse.json(
        { error: "Invalid filename" },
        { status: 400 }
      );
    }

    const oldPath = path.join(UPLOADS_DIR, oldName);
    const newPath = path.join(UPLOADS_DIR, newName);

    // Path verification for both
    if (!validateFilePath(oldPath, UPLOADS_DIR) || !validateFilePath(newPath, UPLOADS_DIR)) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 }
      );
    }

    // Symlink checks
    if (fs.existsSync(oldPath) && isSymlink(oldPath)) {
      return NextResponse.json(
        { error: "Invalid file" },
        { status: 400 }
      );
    }

    // File checks
    if (!fs.existsSync(oldPath)) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    if (fs.existsSync(newPath)) {
      return NextResponse.json(
        { error: "Filename already exists" },
        { status: 409 }
      );
    }

    // Atomic rename
    fs.renameSync(oldPath, newPath);

    logSecurityEvent("FILE_RENAMED_SECURE", {
      oldName,
      newName,
    });

    return NextResponse.json({
      success: true,
      filename: newName,
      url: `${BASE_URL}/${newName}`,
    });
  } catch (error) {
    logSecurityEvent("RENAME_ERROR", {
      error: error.message,
    });
    return NextResponse.json(
      { error: "Failed to rename file" },
      { status: 500 }
    );
  }
}

/**
 * Determine MIME type safely
 */
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();

  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".zip": "application/zip",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
  };

  return mimeTypes[ext] || "application/octet-stream";
}
