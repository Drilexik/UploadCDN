import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { checkAuth, UPLOADS_DIR, sanitizeFilename, BASE_URL } from "@/lib/storage";

export async function DELETE(request, { params }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const filename = sanitizeFilename(params.filename);
  const filepath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  fs.unlinkSync(filepath);
  return NextResponse.json({ success: true });
}

export async function PATCH(request, { params }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { newFilename } = await request.json();
  const oldName = sanitizeFilename(params.filename);
  const newName = sanitizeFilename(newFilename || "");
  if (!newName) return NextResponse.json({ error: "New filename required" }, { status: 400 });

  const oldPath = path.join(UPLOADS_DIR, oldName);
  const newPath = path.join(UPLOADS_DIR, newName);

  if (!fs.existsSync(oldPath)) return NextResponse.json({ error: "File not found" }, { status: 404 });
  if (fs.existsSync(newPath)) return NextResponse.json({ error: "Filename already exists" }, { status: 409 });

  fs.renameSync(oldPath, newPath);
  return NextResponse.json({ success: true, filename: newName, url: `${BASE_URL}/${newName}` });
}
