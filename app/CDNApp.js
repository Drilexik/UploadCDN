"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload, Lock, LogOut, Copy, Trash2, Link2, RefreshCw,
  CheckCheck, File, AlertCircle, Edit3, Check, X,
  Zap, Shield, Globe, ArrowRight,
} from "lucide-react";

const API = "/api";

function formatBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  return (b / (1024 * 1024)).toFixed(1) + " MB";
}
function timeAgo(date) {
  const s = (Date.now() - new Date(date)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}
function isImage(f) { return /\.(png|jpg|jpeg|gif|webp|svg|ico|avif)$/i.test(f); }

function CopyBtn({ text, small }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={e => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className={`flex items-center gap-1 rounded-lg font-mono transition-all ${small ? "px-2 py-0.5 text-xs" : "px-3 py-1.5 text-xs"}`}
      style={{
        background: copied ? "rgba(52,211,153,0.12)" : "rgba(139,92,246,0.12)",
        color: copied ? "var(--green)" : "var(--accent2)",
        border: `1px solid ${copied ? "rgba(52,211,153,0.3)" : "rgba(139,92,246,0.25)"}`,
      }}
    >
      {copied ? <CheckCheck size={11} /> : <Copy size={11} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function FileCard({ file, onDelete, onRename }) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(file.filename);
  const [deleting, setDeleting] = useState(false);

  const handleRename = async () => {
    if (newName === file.filename || !newName.trim()) { setRenaming(false); return; }
    await onRename(file.filename, newName.trim());
    setRenaming(false);
  };

  return (
    <div className="card fade-up flex flex-col gap-3 p-4 group">
      <div className="w-full h-28 rounded-xl flex items-center justify-center overflow-hidden relative"
        style={{ background: "var(--surface2)" }}>
        {isImage(file.filename) ? (
          <img src={file.url} alt={file.filename} className="max-h-full max-w-full object-contain"
            onError={e => { e.target.style.display = "none"; }} />
        ) : (
          <File size={28} style={{ color: "var(--muted)" }} />
        )}
        <a href={file.url} target="_blank" rel="noreferrer"
          className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "rgba(0,0,0,0.7)", color: "var(--accent2)" }}>
          <Link2 size={12} />
        </a>
      </div>

      {renaming ? (
        <div className="flex items-center gap-1">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false); }}
            autoFocus className="flex-1 text-xs font-mono px-2 py-1 rounded-lg outline-none"
            style={{ background: "var(--surface3)", border: "1px solid var(--accent)", color: "var(--text)" }} />
          <button onClick={handleRename} style={{ color: "var(--green)" }}><Check size={13} /></button>
          <button onClick={() => { setRenaming(false); setNewName(file.filename); }} style={{ color: "var(--muted)" }}><X size={13} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono flex-1 truncate" style={{ color: "var(--text2)" }} title={file.filename}>
            {file.filename}
          </span>
          <button onClick={() => setRenaming(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            style={{ color: "var(--muted)" }}>
            <Edit3 size={12} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
        style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
        <span className="text-xs font-mono flex-1 truncate" style={{ color: "var(--muted)" }}>{file.url}</span>
        <CopyBtn text={file.url} small />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--muted)" }}>{formatBytes(file.size)} · {timeAgo(file.mtime)}</span>
        <button onClick={async () => { setDeleting(true); await onDelete(file.filename); }}
          disabled={deleting}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all"
          style={{ background: "rgba(248,113,113,0.08)", color: "var(--red)", border: "1px solid rgba(248,113,113,0.15)" }}>
          {deleting ? <RefreshCw size={11} className="spinner" /> : <Trash2 size={11} />} Delete
        </button>
      </div>
    </div>
  );
}

// ── Landing ────────────────────────────────────────────────────
function Landing({ onEnter }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <div className="fixed inset-0 grid-bg pointer-events-none" />
      <div className="fixed pointer-events-none" style={{
        top: "-15%", left: "50%", transform: "translateX(-50%)",
        width: 700, height: 700, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)",
      }} />

      <nav className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Drilex" className="w-8 h-8 rounded-lg" />
          <span className="font-mono font-bold text-sm" style={{ color: "var(--text)" }}>
            drilex<span style={{ color: "var(--accent2)" }}>.cdn</span>
          </span>
        </div>
        <button onClick={onEnter}
          className="flex items-center gap-2 text-sm font-mono px-4 py-2 rounded-xl transition-all"
          style={{ background: "var(--surface2)", color: "var(--accent2)", border: "1px solid var(--border2)" }}>
          <Lock size={13} /> Admin
        </button>
      </nav>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center gap-10 py-20">
        <div className="float" style={{ filter: "drop-shadow(0 0 40px rgba(139,92,246,0.5))" }}>
          <img src="/logo.png" alt="Drilex" className="w-24 h-24 rounded-2xl" style={{
            boxShadow: "0 0 60px rgba(139,92,246,0.4), 0 0 120px rgba(139,92,246,0.15)",
          }} />
        </div>

        <div className="flex flex-col items-center gap-4 max-w-2xl">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono"
            style={{ background: "var(--accent-dim)", color: "var(--accent2)", border: "1px solid rgba(139,92,246,0.25)" }}>
            <Zap size={11} /> Static · Fast · Permanent
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-none">
            <span style={{ color: "var(--text)" }}>Your personal</span>
            <br />
            <span className="shimmer-text">CDN platform</span>
          </h1>
          <p className="text-lg" style={{ color: "var(--text2)", maxWidth: 480 }}>
            Upload logos, favicons, images and assets. Get a permanent static URL instantly. No expiry. No fuss.
          </p>
        </div>

        <div className="flex items-center rounded-2xl overflow-hidden text-sm font-mono"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)", boxShadow: "0 0 40px rgba(139,92,246,0.12)" }}>
          <div className="px-5 py-3.5 flex items-center gap-2" style={{ color: "var(--muted)", borderRight: "1px solid var(--border)" }}>
            <Globe size={14} style={{ color: "var(--accent)" }} />
            <span style={{ color: "var(--accent2)" }}>upload.drilex.cz</span>
            <span style={{ color: "var(--muted)" }}>/</span>
          </div>
          <div className="px-5 py-3.5" style={{ color: "var(--text)" }}>logo.png</div>
          <div className="px-4 py-3.5" style={{ borderLeft: "1px solid var(--border)" }}>
            <CopyBtn text="https://upload.drilex.cz/logo.png" small />
          </div>
        </div>

        <button onClick={onEnter}
          className="glow-btn flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-semibold"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--accent2))", color: "#fff" }}>
          <Upload size={18} /> Upload Files <ArrowRight size={16} />
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mt-4">
          {[
            { icon: Zap, title: "Instant URLs", desc: "Choose your own filename and get a permanent link immediately" },
            { icon: Shield, title: "Admin Protected", desc: "Password-secured uploads, public read access for everyone" },
            { icon: Globe, title: "Permanent Links", desc: "Static URLs that never expire, change, or go down" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-5 flex flex-col gap-2 text-left">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "var(--accent-dim)", color: "var(--accent2)" }}>
                <Icon size={15} />
              </div>
              <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 text-center py-6 text-xs font-mono" style={{ color: "var(--muted)" }}>
        upload.drilex.cz · self-hosted CDN by Drilex
      </footer>
    </div>
  );
}

// ── Login ──────────────────────────────────────────────────────
function Login({ onSuccess, onBack }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const tryLogin = async (e, password) => {
    if (e) e.preventDefault();
    const usePw = password || pw;
    if (!usePw) return;
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API}/files`, { headers: { "x-admin-password": usePw } });
      if (!res.ok) throw new Error();
      const files = await res.json();
      localStorage.setItem("cdn_pw", usePw);
      onSuccess(usePw, files);
    } catch {
      setError("Wrong password.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const saved = localStorage.getItem("cdn_pw");
    if (saved) { setPw(saved); tryLogin(null, saved); }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="fixed inset-0 grid-bg pointer-events-none" />
      <div className="fixed pointer-events-none inset-0 flex items-center justify-center">
        <div style={{
          width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)",
        }} />
      </div>

      <div className="relative w-full max-w-sm fade-up">
        <div className="flex flex-col items-center mb-8 gap-4">
          <img src="/logo.png" alt="Drilex" className="w-16 h-16 rounded-2xl float"
            style={{ boxShadow: "0 0 40px rgba(139,92,246,0.5)" }} />
          <div className="text-center">
            <h1 className="font-mono font-bold text-xl" style={{ color: "var(--text)" }}>
              drilex<span style={{ color: "var(--accent2)" }}>.cdn</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Admin access required</p>
          </div>
        </div>

        <form onSubmit={tryLogin} className="card p-6 flex flex-col gap-4">
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
            <input type="password" value={pw} onChange={e => setPw(e.target.value)}
              placeholder="Enter admin password"
              className="w-full pl-9 pr-4 py-3 rounded-xl text-sm font-mono outline-none transition-all"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
              onFocus={e => e.target.style.borderColor = "var(--accent)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"}
              autoFocus />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--red)" }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <button type="submit" disabled={!pw || loading}
            className="glow-btn w-full py-3 rounded-xl text-sm font-mono font-semibold"
            style={{
              background: "linear-gradient(135deg, var(--accent), var(--accent2))",
              color: "#fff", opacity: !pw || loading ? 0.5 : 1,
            }}>
            {loading ? "Checking…" : "Enter CDN →"}
          </button>
          <button type="button" onClick={onBack}
            className="text-xs text-center font-mono transition-colors"
            style={{ color: "var(--muted)" }}>
            ← Back to home
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Admin ──────────────────────────────────────────────────────
function Admin({ password, initialFiles, onLogout }) {
  const [files, setFiles] = useState(initialFiles);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [customName, setCustomName] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const fileInputRef = useRef(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/files`, { headers: { "x-admin-password": password } });
      setFiles(await res.json());
    } finally { setLoading(false); }
  }, [password]);

  const doUpload = async () => {
    if (!pendingFile) return;
    setUploading(true); setUploadError(""); setUploadResult(null);
    const fd = new FormData();
    fd.append("file", pendingFile);
    if (customName) fd.append("filename", customName);
    try {
      const res = await fetch(`${API}/upload`, { method: "POST", headers: { "x-admin-password": password }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setUploadResult(data);
      setPendingFile(null); setCustomName("");
      await fetchFiles();
    } catch (err) { setUploadError(err.message); }
    finally { setUploading(false); }
  };

  const handleDrop = e => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) { setPendingFile(f); setCustomName(f.name); }
  };
  const handleInput = e => {
    const f = e.target.files[0];
    if (f) { setPendingFile(f); setCustomName(f.name); }
  };

  const deleteFile = async filename => {
    await fetch(`${API}/files/${encodeURIComponent(filename)}`, {
      method: "DELETE", headers: { "x-admin-password": password },
    });
    setFiles(f => f.filter(x => x.filename !== filename));
  };

  const renameFile = async (old_, new_) => {
    const res = await fetch(`${API}/files/${encodeURIComponent(old_)}`, {
      method: "PATCH",
      headers: { "x-admin-password": password, "Content-Type": "application/json" },
      body: JSON.stringify({ newFilename: new_ }),
    });
    if (res.ok) await fetchFiles();
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="fixed inset-0 grid-bg pointer-events-none" />

      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: "rgba(8,7,15,0.85)", borderBottom: "1px solid var(--border)", backdropFilter: "blur(16px)" }}>
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Drilex" className="w-8 h-8 rounded-lg" />
          <span className="font-mono font-bold text-sm" style={{ color: "var(--text)" }}>
            drilex<span style={{ color: "var(--accent2)" }}>.cdn</span>
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-lg"
            style={{ background: "var(--accent-dim)", color: "var(--accent2)", border: "1px solid rgba(139,92,246,0.2)" }}>
            {files.length} file{files.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchFiles} className="p-2 rounded-lg" style={{ color: "var(--muted)" }}>
            <RefreshCw size={15} className={loading ? "spinner" : ""} />
          </button>
          <button onClick={onLogout}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-2 rounded-xl"
            style={{ background: "rgba(248,113,113,0.08)", color: "var(--red)", border: "1px solid rgba(248,113,113,0.15)" }}>
            <LogOut size={13} /> Logout
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Upload */}
        <div className="card p-6 flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <Upload size={15} style={{ color: "var(--accent)" }} />
            <h2 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Upload Asset</h2>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer"
            style={{
              minHeight: 160,
              border: `2px dashed ${dragOver ? "var(--accent)" : pendingFile ? "rgba(52,211,153,0.5)" : "var(--border2)"}`,
              background: dragOver ? "rgba(139,92,246,0.07)" : pendingFile ? "rgba(52,211,153,0.04)" : "var(--surface2)",
              transition: "all 0.2s",
            }}>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleInput} />
            {pendingFile ? (
              <>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(52,211,153,0.15)", color: "var(--green)" }}>
                  <Check size={22} />
                </div>
                <p className="text-sm font-mono" style={{ color: "var(--text)" }}>{pendingFile.name}</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>{formatBytes(pendingFile.size)}</p>
              </>
            ) : (
              <>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--accent-dim)", color: "var(--accent2)" }}>
                  <Upload size={22} />
                </div>
                <p className="text-sm" style={{ color: "var(--text2)" }}>
                  Drop file here or <span style={{ color: "var(--accent2)" }}>browse</span>
                </p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>Any file · max 50 MB</p>
              </>
            )}
          </div>

          {pendingFile && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono" style={{ color: "var(--muted)" }}>
                CDN path — <span style={{ color: "var(--accent2)" }}>upload.drilex.cz/</span>
                <span style={{ color: "var(--text2)" }}>your-filename.ext</span>
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}>
                <span className="text-xs font-mono shrink-0" style={{ color: "var(--muted)" }}>upload.drilex.cz/</span>
                <input value={customName} onChange={e => setCustomName(e.target.value)}
                  placeholder="logo.png"
                  className="flex-1 bg-transparent outline-none text-sm font-mono"
                  style={{ color: "var(--text)" }} />
              </div>
            </div>
          )}

          {uploadError && (
            <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl"
              style={{ background: "rgba(248,113,113,0.08)", color: "var(--red)", border: "1px solid rgba(248,113,113,0.2)" }}>
              <AlertCircle size={13} /> {uploadError}
            </div>
          )}

          {uploadResult && (
            <div className="flex flex-col gap-2 px-4 py-3 rounded-xl fade-in"
              style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.2)" }}>
              <p className="text-sm flex items-center gap-2" style={{ color: "var(--green)" }}>
                <CheckCheck size={14} /> Uploaded! Permanent CDN link:
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono flex-1 truncate" style={{ color: "var(--text)" }}>{uploadResult.url}</span>
                <CopyBtn text={uploadResult.url} />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            {pendingFile && (
              <button onClick={() => { setPendingFile(null); setCustomName(""); setUploadResult(null); setUploadError(""); }}
                className="px-4 py-2.5 rounded-xl text-sm font-mono"
                style={{ background: "var(--surface2)", color: "var(--muted)", border: "1px solid var(--border)" }}>
                Cancel
              </button>
            )}
            <button onClick={doUpload} disabled={!pendingFile || uploading}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-mono font-semibold ${pendingFile && !uploading ? "glow-btn" : ""}`}
              style={{
                background: pendingFile && !uploading ? "linear-gradient(135deg, var(--accent), var(--accent2))" : "var(--surface2)",
                color: pendingFile && !uploading ? "#fff" : "var(--muted)",
                cursor: !pendingFile || uploading ? "not-allowed" : "pointer",
              }}>
              {uploading ? <><RefreshCw size={14} className="spinner" /> Uploading…</> : <><Upload size={14} /> Upload to CDN</>}
            </button>
          </div>
        </div>

        {/* Files */}
        <div className="flex flex-col gap-4">
          <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: "var(--text)" }}>
            All Files <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>({files.length})</span>
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-16" style={{ color: "var(--muted)" }}>
              <RefreshCw size={18} className="spinner mr-3" /> Loading…
            </div>
          ) : files.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-20 gap-3">
              <Upload size={32} style={{ color: "var(--muted)" }} />
              <p className="text-sm" style={{ color: "var(--muted)" }}>No files yet — upload your first asset</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {files.map(f => (
                <FileCard key={f.filename} file={f} onDelete={deleteFile} onRename={renameFile} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────
export default function CDNApp() {
  const [page, setPage] = useState("landing");
  const [password, setPassword] = useState("");
  const [files, setFiles] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("cdn_pw");
    if (saved) {
      fetch(`${API}/files`, { headers: { "x-admin-password": saved } })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(f => { setPassword(saved); setFiles(f); setPage("admin"); })
        .catch(() => {});
    }
  }, []);

  if (page === "landing") return <Landing onEnter={() => setPage("login")} />;
  if (page === "login") return (
    <Login
      onSuccess={(pw, f) => { setPassword(pw); setFiles(f); setPage("admin"); }}
      onBack={() => setPage("landing")}
    />
  );
  return (
    <Admin
      password={password}
      initialFiles={files}
      onLogout={() => { localStorage.removeItem("cdn_pw"); setPassword(""); setPage("landing"); }}
    />
  );
}
