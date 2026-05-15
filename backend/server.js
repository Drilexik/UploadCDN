require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";
const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());

// Serve the React admin UI
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

function requireAuth(req, res, next) {
  const auth = req.headers["x-admin-password"];
  if (auth !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const custom = req.body.filename || req.query.filename;
    if (custom) {
      const safe = custom.replace(/[^a-zA-Z0-9._-]/g, "").replace(/\.{2,}/g, "");
      cb(null, safe || file.originalname.replace(/[^a-zA-Z0-9._-]/g, ""));
    } else {
      cb(null, file.originalname.replace(/[^a-zA-Z0-9._-]/g, ""));
    }
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ── API ────────────────────────────────────────────────────────

app.post("/api/upload", requireAuth, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const filename = req.file.filename;
    res.json({
      success: true,
      filename,
      url: `${BASE_URL}/${filename}`,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  });
});

app.get("/api/files", requireAuth, (req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR).map((name) => {
      const stat = fs.statSync(path.join(UPLOADS_DIR, name));
      return { filename: name, url: `${BASE_URL}/${name}`, size: stat.size, createdAt: stat.birthtime, mtime: stat.mtime };
    });
    files.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/files/:filename", requireAuth, (req, res) => {
  const filename = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, "");
  const filepath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: "File not found" });
  fs.unlinkSync(filepath);
  res.json({ success: true });
});

app.post("/api/files/:filename/rename", requireAuth, (req, res) => {
  const oldName = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, "");
  const newName = (req.body.newFilename || "").replace(/[^a-zA-Z0-9._-]/g, "").replace(/\.{2,}/g, "");
  if (!newName) return res.status(400).json({ error: "New filename required" });
  const oldPath = path.join(UPLOADS_DIR, oldName);
  const newPath = path.join(UPLOADS_DIR, newName);
  if (!fs.existsSync(oldPath)) return res.status(404).json({ error: "File not found" });
  if (fs.existsSync(newPath)) return res.status(409).json({ error: "Target filename already exists" });
  fs.renameSync(oldPath, newPath);
  res.json({ success: true, filename: newName, url: `${BASE_URL}/${newName}` });
});

// ── CDN: serve uploaded files at root ─────────────────────────
app.use(express.static(UPLOADS_DIR));

// SPA fallback
if (fs.existsSync(publicDir)) {
  app.get("*", (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.path.replace(/^\//, ""));
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.sendFile(filePath);
    } else {
      res.sendFile(path.join(publicDir, "index.html"));
    }
  });
}

app.listen(PORT, () => {
  console.log(`CDN running on :${PORT} | uploads: ${UPLOADS_DIR} | base: ${BASE_URL}`);
});
