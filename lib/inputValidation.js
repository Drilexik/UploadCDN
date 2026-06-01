import { NextResponse } from "next/server";

/**
 * Advanced input validation and sanitization
 * Prevents code injection, command injection, and various XSS attacks
 */

// Regular expressions for detecting malicious patterns
const MALICIOUS_PATTERNS = {
  // Command injection patterns
  commandInjection: /[;&|`$()\[\]{}]*\s*(rm|cat|wget|curl|bash|sh|cmd|powershell|python)/i,
  
  // Script injection patterns
  scriptInjection: /<script[^>]*>[\s\S]*?<\/script>/gi,
  eventHandler: /on\w+\s*=/gi,
  dataProtocol: /data:text\/html/i,
  javascriptProtocol: /javascript:/i,
  
  // SQL injection patterns
  sqlInjection: /('|")\s*(OR|AND|UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\s*('|")/i,
  
  // Path traversal patterns (additional)
  pathTraversal: /\.\.\//g,
  windowsPathTraversal: /\.\.\\/g,
  
  // XXE patterns
  xmlExternalEntity: /<!ENTITY|SYSTEM|PUBLIC/i,
  
  // LDAP injection
  ldapInjection: /[*()&|]/,
};

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input) {
  if (typeof input !== "string") {
    throw new Error("Input must be a string");
  }

  // Convert to string and limit length
  let sanitized = String(input).substring(0, 1000);

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");

  return sanitized;
}

/**
 * Validate filename to prevent various injection attacks
 */
export function validateFilenameStrict(filename) {
  // Check against all malicious patterns
  for (const [patternName, pattern] of Object.entries(MALICIOUS_PATTERNS)) {
    if (pattern.test(filename)) {
      return {
        valid: false,
        reason: patternName,
        filename,
      };
    }
  }

  // Check for null bytes
  if (filename.includes("\0")) {
    return {
      valid: false,
      reason: "nullByte",
      filename,
    };
  }

  // Check for unusual unicode characters
  if (!/^[\x20-\x7E]+$/.test(filename)) {
    // Allows printable ASCII characters
    return {
      valid: false,
      reason: "invalidCharacters",
      filename,
    };
  }

  return { valid: true };
}

/**
 * Validate JSON request body
 */
export function validateJSONRequest(body) {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  // Check for prototype pollution
  if ("__proto__" in body || "constructor" in body || "prototype" in body) {
    return { valid: false, error: "Forbidden property detected" };
  }

  return { valid: true };
}

/**
 * Prevent directory traversal in paths
 */
export function isPathTraversalAttempt(input) {
  const normalized = input.normalize("NFD").toLowerCase();

  const traversalPatterns = [
    /\.\.\//,
    /\.\.\\/,
    /%2e%2e%2f/,
    /%2e%2e%5c/,
    /\.\.;/,
    /\.\.%00/,
    /[^\x20-\x7E]/,
  ];

  return traversalPatterns.some((pattern) => pattern.test(normalized));
}

/**
 * Sanitize error messages to prevent information disclosure
 */
export function sanitizeErrorMessage(error, isDevelopment = false) {
  if (isDevelopment) {
    return error.message;
  }

  // Production: return generic message
  const genericMessages = {
    EACCES: "Access denied",
    ENOENT: "Resource not found",
    ENOTDIR: "Invalid path",
    EISDIR: "Is a directory",
    EMFILE: "Too many open files",
    ENOSPC: "No space available",
    EEXIST: "Resource already exists",
  };

  if (error.code && genericMessages[error.code]) {
    return genericMessages[error.code];
  }

  return "An error occurred. Please try again.";
}

/**
 * Validate and parse JSON safely
 */
export function parseJSONSafely(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);

    // Check for prototype pollution
    if (
      parsed &&
      (Object.prototype.hasOwnProperty.call(parsed, "__proto__") ||
        Object.prototype.hasOwnProperty.call(parsed, "constructor") ||
        Object.prototype.hasOwnProperty.call(parsed, "prototype"))
    ) {
      throw new Error("Prototype pollution detected");
    }

    return { success: true, data: parsed };
  } catch (error) {
    return { success: false, error: "Invalid JSON" };
  }
}

/**
 * Content Security Policy enforcement middleware response
 */
export function createSecureResponse(data, headers = {}) {
  const response = NextResponse.json(data);

  // Add security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Content-Security-Policy", "default-src 'none'");

  // Apply custom headers
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Detect suspicious file content
 */
export function detectSuspiciousContent(buffer, filename) {
  const suspiciousSignatures = [
    // Executable signatures
    { sig: Buffer.from([0x4d, 0x5a]), name: "Windows PE/EXE" }, // MZ header
    { sig: Buffer.from([0x7f, 0x45, 0x4c, 0x46]), name: "ELF Binary" }, // ELF
    { sig: Buffer.from([0xca, 0xfe, 0xba, 0xbe]), name: "Mach-O Binary" }, // Mach-O
    
    // Script signatures
    { sig: Buffer.from("#!/bin/bash"), name: "Bash Script" },
    { sig: Buffer.from("#!/bin/sh"), name: "Shell Script" },
    { sig: Buffer.from("#!/usr/bin/python"), name: "Python Script" },
  ];

  // Magic bytes/shebangs only carry meaning at the *start* of a file. Scanning
  // the whole buffer with includes() false-positives constantly (legitimate
  // zip/pdf/mp4 files contain 0x4D 0x5A "MZ" somewhere by chance), so we match
  // the signature against the file header only.
  for (const { sig, name } of suspiciousSignatures) {
    if (buffer.length >= sig.length && buffer.subarray(0, sig.length).equals(sig)) {
      return { suspicious: true, type: name };
    }
  }

  return { suspicious: false };
}

/**
 * Validate request size
 */
export function validateRequestSize(size, maxSize = 100 * 1024 * 1024) {
  if (size > maxSize) {
    return { valid: false, error: `Request exceeds maximum size of ${maxSize} bytes` };
  }
  return { valid: true };
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length = 32) {
  const crypto = require("crypto");
  return crypto.randomBytes(length).toString("hex");
}
