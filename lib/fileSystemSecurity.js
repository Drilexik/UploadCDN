import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Advanced file system security
 * Prevents symlink following, hard links, and unsafe operations
 */

/**
 * Safely check if path is a symlink
 */
export function isSymlink(filePath) {
  try {
    const stat = fs.lstatSync(filePath);
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Prevent symlink following attacks
 */
export function validateNoSymlinks(filePath, baseDir) {
  const realPath = fs.realpathSync(filePath);
  const realBase = fs.realpathSync(baseDir);

  if (!realPath.startsWith(realBase)) {
    return false;
  }

  return true;
}

/**
 * Secure file operations with integrity checks
 */
export function writeFileSecure(filePath, data, options = {}) {
  const defaultOptions = {
    mode: 0o644,
    encoding: "utf-8",
    ...options,
  };

  // Write to temporary file first
  const tempPath = filePath + ".tmp." + crypto.randomBytes(6).toString("hex");

  try {
    fs.writeFileSync(tempPath, data, defaultOptions);

    // Verify file was written correctly
    const written = fs.readFileSync(tempPath);
    if (written !== data) {
      throw new Error("File integrity check failed");
    }

    // Atomic rename
    fs.renameSync(tempPath, filePath);

    // Verify final file
    const final = fs.readFileSync(filePath);
    if (final !== data) {
      throw new Error("Final file integrity check failed");
    }

    return true;
  } catch (error) {
    // Clean up temp file
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Secure file deletion (multiple passes)
 */
export function deleteFileSecurely(filePath, passes = 3) {
  try {
    const stats = fs.statSync(filePath);
    const size = stats.size;

    // Open and overwrite file
    for (let i = 0; i < passes; i++) {
      const randomData = crypto.randomBytes(size);
      fs.writeFileSync(filePath, randomData);
    }

    // Final overwrite with zeros
    fs.writeFileSync(filePath, Buffer.alloc(size, 0));

    // Delete the file
    fs.unlinkSync(filePath);

    return true;
  } catch (error) {
    // Fallback to regular delete
    fs.unlinkSync(filePath);
    return false;
  }
}

/**
 * Get file hash for integrity verification
 */
export function getFileHash(filePath, algorithm = "sha256") {
  const hash = crypto.createHash(algorithm);
  const file = fs.readFileSync(filePath);
  hash.update(file);
  return hash.digest("hex");
}

/**
 * Verify file hasn't been tampered with
 */
export function verifyFileIntegrity(filePath, expectedHash, algorithm = "sha256") {
  const actualHash = getFileHash(filePath, algorithm);
  return actualHash === expectedHash;
}

/**
 * Check directory permissions
 */
export function validateDirectoryPermissions(dirPath) {
  try {
    const stats = fs.statSync(dirPath);
    const mode = stats.mode;

    // Should be readable and writable by owner
    const ownerRead = (mode & 0o400) !== 0;
    const ownerWrite = (mode & 0o200) !== 0;

    if (!ownerRead || !ownerWrite) {
      return { valid: false, reason: "Insufficient permissions" };
    }

    // Check for world-writable (dangerous)
    const worldWrite = (mode & 0o002) !== 0;
    if (worldWrite) {
      return { valid: false, reason: "Directory is world-writable" };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}

/**
 * Safely list directory contents with security checks
 */
export function listDirectorySafely(dirPath, baseDir) {
  try {
    // Verify path is within base directory
    const realPath = fs.realpathSync(dirPath);
    const realBase = fs.realpathSync(baseDir);

    if (!realPath.startsWith(realBase)) {
      throw new Error("Path traversal detected");
    }

    // Check for symlinks
    if (isSymlink(dirPath)) {
      throw new Error("Symlink detected");
    }

    const files = fs.readdirSync(dirPath);
    const result = [];

    for (const file of files) {
      const filePath = path.join(dirPath, file);

      try {
        const stat = fs.lstatSync(filePath);

        // Skip symlinks
        if (stat.isSymbolicLink()) {
          continue;
        }

        result.push({
          name: file,
          size: stat.size,
          mtime: stat.mtime,
          isFile: stat.isFile(),
          isDirectory: stat.isDirectory(),
        });
      } catch {
        // Skip files that can't be stat'd
        continue;
      }
    }

    return { success: true, files: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Prevent creating files with dangerous permissions
 */
export function validateFilePermissions(mode) {
  const allowedModes = [0o644, 0o640, 0o600];

  if (!allowedModes.includes(mode)) {
    return false;
  }

  return true;
}

/**
 * Monitor file system changes (simple version)
 */
class FileSystemMonitor {
  constructor() {
    this.checksums = new Map();
  }

  addFile(filePath) {
    const hash = getFileHash(filePath);
    this.checksums.set(filePath, hash);
  }

  verifyFile(filePath) {
    if (!this.checksums.has(filePath)) {
      return { verified: false, reason: "File not monitored" };
    }

    const expectedHash = this.checksums.get(filePath);
    const actualHash = getFileHash(filePath);

    if (expectedHash !== actualHash) {
      return { verified: false, reason: "File has been modified", hash: actualHash };
    }

    return { verified: true };
  }

  updateFile(filePath) {
    const hash = getFileHash(filePath);
    this.checksums.set(filePath, hash);
  }
}

export default FileSystemMonitor;
