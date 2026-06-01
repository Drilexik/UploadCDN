import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { UPLOADS_DIR, BASE_URL } from "@/lib/storage";
import { enforceAuth } from "@/lib/auth";
import {
  validateFilePath,
  sanitizeFilenameSecurity,
  isFilenameBlacklisted,
  logSecurityEvent,
} from "@/lib/security";
import { validateFilenameStrict } from "@/lib/inputValidation";
import { isSymlink } from "@/lib/fileSystemSecurity";
import { createRateLimiter } from "@/lib/rateLimiter";
import { getClientIp } from "@/lib/clientIp";

// 5 requests per minute for file operations
const fileLimiter = createRateLimiter(5, 60000);

// Resolve + validate a filename into a safe absolute path inside UPLOADS_DIR.
// Returns { path } on success or { error, status } describing the rejection.
function resolveSafePath(rawName, ip, context) {
  const filename = sanitizeFilenameSecurity(rawName || "");
  if (!filename) {
    return { error: "Invalid filename", status: 400 };
  }

  const strict = validateFilenameStrict(filename);
  if (!strict.valid) {
    logSecurityEvent("INVALID_FILENAME_FORMAT", { filename, reason: strict.reason, context, ip });
    return { error: "Invalid filename", status: 400 };
  }

  if (isFilenameBlacklisted(filename)) {
    logSecurityEvent("BLACKLISTED_FILENAME", { filename, context, ip });
    return { error: "Invalid filename", status: 400 };
  }

  const filepath = path.join(UPLOADS_DIR, filename);
  if (!validateFilePath(filepath, UPLOADS_DIR)) {
    logSecurityEvent("PATH_TRAVERSAL_ATTEMPT", { attemptedPath: filepath, context, ip });
    return { error: "Invalid file path", status: 400 };
  }

  if (fs.existsSync(filepath) && isSymlink(filepath)) {
    logSecurityEvent("SYMLINK_ATTEMPT", { filepath, context, ip });
    return { error: "Invalid file", status: 400 };
  }

  return { path: filepath, filename };
}

export async function DELETE(request, { params }) {
  const ip = getClientIp(request);

  const rateLimitResult = fileLimiter(request);
  if (rateLimitResult.limited) {
    logSecurityEvent("RATE_LIMIT_EXCEEDED", { endpoint: "/api/files/[filename] DELETE", ip });
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfter) } }
    );
  }

  const auth = enforceAuth(request, "/api/files/[filename] DELETE");
  if (!auth.ok) return auth.response;

  try {
    const safe = resolveSafePath(params.filename, ip, "delete");
    if (safe.error) {
      return NextResponse.json({ error: safe.error }, { status: safe.status });
    }

    if (!fs.existsSync(safe.path)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    fs.unlinkSync(safe.path);
    logSecurityEvent("FILE_DELETED", { filename: safe.filename });

    return NextResponse.json({ success: true });
  } catch (e) {
    logSecurityEvent("DELETE_ERROR", { error: e.message });
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const ip = getClientIp(request);

  const rateLimitResult = fileLimiter(request);
  if (rateLimitResult.limited) {
    logSecurityEvent("RATE_LIMIT_EXCEEDED", { endpoint: "/api/files/[filename] PATCH", ip });
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfter) } }
    );
  }

  const auth = enforceAuth(request, "/api/files/[filename] PATCH");
  if (!auth.ok) return auth.response;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const requestedNew = body && typeof body === "object" ? body.newFilename : "";

    const oldSafe = resolveSafePath(params.filename, ip, "rename-old");
    if (oldSafe.error) {
      return NextResponse.json({ error: oldSafe.error }, { status: oldSafe.status });
    }

    const newSafe = resolveSafePath(requestedNew, ip, "rename-new");
    if (newSafe.error) {
      return NextResponse.json({ error: newSafe.error }, { status: newSafe.status });
    }

    if (!fs.existsSync(oldSafe.path)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (fs.existsSync(newSafe.path)) {
      return NextResponse.json({ error: "Filename already exists" }, { status: 409 });
    }

    fs.renameSync(oldSafe.path, newSafe.path);
    logSecurityEvent("FILE_RENAMED", { oldName: oldSafe.filename, newName: newSafe.filename });

    return NextResponse.json({
      success: true,
      filename: newSafe.filename,
      url: `${BASE_URL}/${newSafe.filename}`,
    });
  } catch (e) {
    logSecurityEvent("RENAME_ERROR", { error: e.message });
    return NextResponse.json({ error: "Failed to rename file" }, { status: 500 });
  }
}
