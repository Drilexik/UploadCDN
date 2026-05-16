import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { checkAuth, UPLOADS_DIR, sanitizeFilename, BASE_URL } from "@/lib/storage";

// Max 50MB
export async function POST(request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const customName = formData.get("filename");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    const originalName = file.name || "upload";
    const filename = sanitizeFilename(
      customName && customName.trim() ? customName.trim() : originalName
    ) || sanitizeFilename(originalName);

    if (!filename) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const filepath = path.join(UPLOADS_DIR, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    return NextResponse.json({
      success: true,
      filename,
      url: `${BASE_URL}/${filename}`,
      size: buffer.length,
      mimetype: file.type,
    });
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
