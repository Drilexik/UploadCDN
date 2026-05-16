import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { listFiles, checkAuth, UPLOADS_DIR } from "@/lib/storage";

export async function GET(request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(listFiles());
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
