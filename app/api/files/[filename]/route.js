import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { checkAuth, UPLOADS_DIR, BASE_URL } from "@/lib/storage";
import {
  validateFilePath,
  sanitizeFilenameSecurity,
  isFilenameBlacklisted,
  logSecurityEvent,
} from "@/lib/security";
import { createRateLimiter } from "@/lib/rateLimiter";

// 5 requests per minute for file operations
const fileLimiter = createRateLimiter(5, 60000);

export async function DELETE(request, { params }) {
  // Rate limiting
  const rateLimitResult = fileLimiter(request);
  if (rateLimitResult.limited) {
    logSecurityEvent("RATE_LIMIT_EXCEEDED", {
      endpoint: "/api/files/[filename] DELETE",
      ip: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": rateLimitResult.retryAfter },
      }
    );
  }

  // Authentication
  if (!checkAuth(request)) {
    logSecurityEvent("UNAUTHORIZED_DELETE_ATTEMPT", {
      filename: params.filename,
      ip: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const filename = sanitizeFilenameSecurity(params.filename);
    
    if (!filename) {
      return NextResponse.json(
        { error: "Invalid filename" },
        { status: 400 }
      );
    }

    const filepath = path.join(UPLOADS_DIR, filename);

    // Path traversal protection
    if (!validateFilePath(filepath, UPLOADS_DIR)) {
      logSecurityEvent("PATH_TRAVERSAL_ATTEMPT_DELETE", {
        attemptedPath: filepath,
        ip: request.headers.get("x-forwarded-for"),
      });
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    if (!fs.existsSync(filepath)) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    fs.unlinkSync(filepath);
    
    logSecurityEvent("FILE_DELETED", {
      filename,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    logSecurityEvent("DELETE_ERROR", {
      error: e.message,
    });
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  // Rate limiting
  const rateLimitResult = fileLimiter(request);
  if (rateLimitResult.limited) {
    logSecurityEvent("RATE_LIMIT_EXCEEDED", {
      endpoint: "/api/files/[filename] PATCH",
      ip: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": rateLimitResult.retryAfter },
      }
    );
  }

  // Authentication
  if (!checkAuth(request)) {
    logSecurityEvent("UNAUTHORIZED_RENAME_ATTEMPT", {
      filename: params.filename,
      ip: request.headers.get("x-forwarded-for"),
    });
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

    const { newFilename } = body;
    const oldName = sanitizeFilenameSecurity(params.filename);
    const newName = sanitizeFilenameSecurity(newFilename || "");

    if (!oldName || !newName) {
      return NextResponse.json(
        { error: "Invalid filename" },
        { status: 400 }
      );
    }

    // Blacklist checks
    if (isFilenameBlacklisted(oldName) || isFilenameBlacklisted(newName)) {
      logSecurityEvent("BLACKLISTED_FILENAME_RENAME", {
        oldName,
        newName,
        ip: request.headers.get("x-forwarded-for"),
      });
      return NextResponse.json(
        { error: "Invalid filename" },
        { status: 400 }
      );
    }

    const oldPath = path.join(UPLOADS_DIR, oldName);
    const newPath = path.join(UPLOADS_DIR, newName);

    // Path traversal protection
    if (!validateFilePath(oldPath, UPLOADS_DIR) || !validateFilePath(newPath, UPLOADS_DIR)) {
      logSecurityEvent("PATH_TRAVERSAL_ATTEMPT_RENAME", {
        oldPath,
        newPath,
        ip: request.headers.get("x-forwarded-for"),
      });
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

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

    fs.renameSync(oldPath, newPath);

    logSecurityEvent("FILE_RENAMED", {
      oldName,
      newName,
    });

    return NextResponse.json({
      success: true,
      filename: newName,
      url: `${BASE_URL}/${newName}`,
    });
  } catch (e) {
    logSecurityEvent("RENAME_ERROR", {
      error: e.message,
    });
    return NextResponse.json(
      { error: "Failed to rename file" },
      { status: 500 }
    );
  }
}
