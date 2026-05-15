import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload, Lock, LogOut, Copy, Trash2, Link, RefreshCw,
  CheckCheck, FileImage, File, AlertCircle, X, Edit3, Check
} from "lucide-react";

const API = "/api";

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function timeAgo(date) {
  const d = new Date(date);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

function isImage(filename) {
  return /\.(png|jpg|jpeg|gif|webp|svg|ico|avif)$/i.test(filename);
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      title="Copy URL"
      className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
      style={{
        background: copied ? "rgba(52,211,153,0.12)" : "rgba(79,142,255,0.08)",
        color: copied ? "var(--green)" : "var(--accent)",
        border: `1px solid ${copied ? "rgba(52,211,153,0.25)" : "rgba(79,142,255,0.2)"}`,
      }}
    >
      {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function FileCard({ file, onDelete, onRename }) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(file.filename);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef(null);

  const handleRename = async () => {
    if (newName === file.filename || !newName.trim()) { setRenaming(false); return; }
    await onRename(file.filename, newName.trim());
    setRenaming(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(file.filename);
  };

  return (
    <div
      className="fade-up rounded-xl p-4 flex flex-col gap-3 group"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        transition: "border-color 0.2s",
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(79,142,255,0.3)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
    >
      {/* Preview */}
      <div
        className="w-full h-32 rounded-lg flex items-center justify-center overflow-hidden relative"
        style={{ background: "var(--surface2)" }}
      >
        {isImage(file.filename) ? (
          <img
            src={file.url}
            alt={file.filename}
            className="max-h-full max-w-full object-contain"
            onError={e => { e.target.style.display = "none"; }}
          />
        ) : (
          <File size={32} style={{ color: "var(--muted)" }} />
        )}
        <div
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ transition: "opacity 0.2s" }}
        >
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center w-7 h-7 rounded-lg"
            style={{ background: "rgba(0,0,0,0.6)", color: "var(--text)" }}
          >
            <Link size={13} />
          </a>
        </div>
      </div>

      {/* Filename */}
      <div className="flex items-center gap-2">
        {renaming ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              ref={inputRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false); }}
              autoFocus
              className="flex-1 text-xs font-mono px-2 py-1 rounded-lg outline-none"
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--accent)",
                color: "var(--text)",
              }}
            />
            <button onClick={handleRename} style={{ color: "var(--green)" }}><Check size={14} /></button>
            <button onClick={() => { setRenaming(false); setNewName(file.filename); }} style={{ color: "var(--muted)" }}><X size={14} /></button>
          </div>
        ) : (
          <span
            className="text-xs font-mono flex-1 truncate"
            style={{ color: "var(--text)" }}
            title={file.filename}
          >
            {file.filename}
          </span>
        )}
        {!renaming && (
          <button
            onClick={() => setRenaming(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            title="Rename"
            style={{ color: "var(--muted)" }}
          >
            <Edit3 size={13} />
          </button>
        )}
      </div>

      {/* URL */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
        style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
      >
        <span className="text-xs font-mono flex-1 truncate" style={{ color: "var(--muted)" }}>
          {file.url}
        </span>
        <CopyBtn text={file.url} />
      </div>

      {/* Meta + delete */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {formatBytes(file.size)} · {timeAgo(file.mtime)}
        </span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all"
          style={{
            background: "rgba(248,113,113,0.08)",
            color: "var(--red)",
            border: "1px solid rgba(248,113,113,0.15)",
          }}
        >
          {deleting ? <RefreshCw size={12} className="spinner" /> : <Trash2 size={12} />}
          Delete
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [password, setPassword] = useState(() => localStorage.getItem("cdn_pw") || "");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  // Upload state
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [customName, setCustomName] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const fileInputRef = useRef(null);

  const fetchFiles = useCallback(async (pw) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/files`, { headers: { "x-admin-password": pw } });
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      setFiles(data);
      setAuthed(true);
    } catch {
      setAuthError("Wrong password.");
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (e) => {
    e.preventDefault();
    setAuthError("");
    localStorage.setItem("cdn_pw", password);
    await fetchFiles(password);
  };

  const logout = () => {
    setAuthed(false);
    setPassword("");
    localStorage.removeItem("cdn_pw");
  };

  useEffect(() => {
    const saved = localStorage.getItem("cdn_pw");
    if (saved) fetchFiles(saved);
  }, [fetchFiles]);

  const doUpload = async (file, name) => {
    setUploading(true);
    setUploadError("");
    setUploadResult(null);
    const fd = new FormData();
    fd.append("file", file);
    if (name) fd.append("filename", name);
    try {
      const res = await fetch(`${API}/upload`, {
        method: "POST",
        headers: { "x-admin-password": password },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setUploadResult(data);
      setPendingFile(null);
      setCustomName("");
      await fetchFiles(password);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) { setPendingFile(file); setCustomName(file.name); }
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) { setPendingFile(file); setCustomName(file.name); }
  };

  const deleteFile = async (filename) => {
    await fetch(`${API}/files/${encodeURIComponent(filename)}`, {
      method: "DELETE",
      headers: { "x-admin-password": password },
    });
    setFiles(f => f.filter(x => x.filename !== filename));
  };

  const renameFile = async (oldName, newName) => {
    const res = await fetch(`${API}/files/${encodeURIComponent(oldName)}/rename`, {
      method: "POST",
      headers: { "x-admin-password": password, "Content-Type": "application/json" },
      body: JSON.stringify({ newFilename: newName }),
    });
    if (res.ok) await fetchFiles(password);
  };

  // LOGIN SCREEN
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
        {/* Background grid */}
        <div className="fixed inset-0 opacity-5" style={{
          backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        <div className="relative w-full max-w-sm fade-up">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: "linear-gradient(135deg, rgba(79,142,255,0.2), rgba(167,139,250,0.2))",
                border: "1px solid rgba(79,142,255,0.3)",
                boxShadow: "0 0 40px rgba(79,142,255,0.15)",
              }}
            >
              <Upload size={24} style={{ color: "var(--accent)" }} />
            </div>
            <h1 className="text-xl font-mono font-semibold" style={{ color: "var(--text)" }}>
              drilex<span style={{ color: "var(--accent)" }}>/cdn</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>upload.drilex.cz</p>
          </div>

          <form onSubmit={login}>
            <div
              className="rounded-2xl p-6 flex flex-col gap-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <label className="text-xs font-mono uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Admin Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-4 py-3 rounded-xl text-sm font-mono outline-none transition-all"
                  style={{
                    background: "var(--surface2)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                  onFocus={e => e.target.style.borderColor = "var(--accent)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"}
                  autoFocus
                />
              </div>
              {authError && (
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--red)" }}>
                  <AlertCircle size={14} /> {authError}
                </div>
              )}
              <button
                type="submit"
                disabled={!password || loading}
                className="w-full py-3 rounded-xl text-sm font-mono font-semibold transition-all"
                style={{
                  background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                  color: "#fff",
                  opacity: !password || loading ? 0.5 : 1,
                }}
              >
                {loading ? "Verifying..." : "Enter CDN"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // MAIN PANEL
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Background grid */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: "linear-gradient(var(--text) 1px, transparent 1px), linear-gradient(90deg, var(--text) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Header */}
      <header
        className="sticky top-0 z-50 px-6 py-4 flex items-center justify-between"
        style={{
          background: "rgba(10,10,11,0.85)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(79,142,255,0.2), rgba(167,139,250,0.2))",
              border: "1px solid rgba(79,142,255,0.3)",
            }}
          >
            <Upload size={15} style={{ color: "var(--accent)" }} />
          </div>
          <span className="font-mono font-semibold text-sm" style={{ color: "var(--text)" }}>
            drilex<span style={{ color: "var(--accent)" }}>/cdn</span>
          </span>
          <span
            className="hidden sm:block text-xs font-mono px-2 py-0.5 rounded"
            style={{ background: "var(--surface2)", color: "var(--muted)", border: "1px solid var(--border)" }}
          >
            {files.length} file{files.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchFiles(password)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--muted)" }}
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? "spinner" : ""} />
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-2 rounded-lg transition-all"
            style={{
              background: "rgba(248,113,113,0.08)",
              color: "var(--red)",
              border: "1px solid rgba(248,113,113,0.15)",
            }}
          >
            <LogOut size={13} /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-8">

        {/* Upload zone */}
        <section className="fade-up">
          <div
            className="rounded-2xl p-6 flex flex-col gap-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <FileImage size={16} style={{ color: "var(--accent)" }} />
              <h2 className="font-mono font-semibold text-sm" style={{ color: "var(--text)" }}>Upload File</h2>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="relative rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
              style={{
                minHeight: 160,
                border: `2px dashed ${dragOver ? "var(--accent)" : pendingFile ? "rgba(52,211,153,0.4)" : "var(--border)"}`,
                background: dragOver
                  ? "rgba(79,142,255,0.06)"
                  : pendingFile
                  ? "rgba(52,211,153,0.04)"
                  : "var(--surface2)",
                animation: dragOver ? "pulse-glow 1s ease infinite" : "none",
              }}
            >
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileInput} />
              {pendingFile ? (
                <>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(52,211,153,0.15)", color: "var(--green)" }}
                  >
                    <Check size={20} />
                  </div>
                  <p className="text-sm font-mono" style={{ color: "var(--text)" }}>{pendingFile.name}</p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>{formatBytes(pendingFile.size)}</p>
                </>
              ) : (
                <>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: "rgba(79,142,255,0.12)",
                      color: "var(--accent)",
                    }}
                  >
                    <Upload size={20} />
                  </div>
                  <p className="text-sm" style={{ color: "var(--text)" }}>Drop file here or click to browse</p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>Max 50 MB · any file type</p>
                </>
              )}
            </div>

            {/* Custom name input */}
            {pendingFile && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-mono" style={{ color: "var(--muted)" }}>
                  CDN filename <span style={{ color: "var(--accent)" }}>(the URL slug)</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>upload.drilex.cz/</span>
                  <input
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="logo.png"
                    className="flex-1 px-3 py-2 rounded-xl text-sm font-mono outline-none transition-all"
                    style={{
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                    onFocus={e => e.target.style.borderColor = "var(--accent)"}
                    onBlur={e => e.target.style.borderColor = "var(--border)"}
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {uploadError && (
              <div
                className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl"
                style={{ background: "rgba(248,113,113,0.08)", color: "var(--red)", border: "1px solid rgba(248,113,113,0.2)" }}
              >
                <AlertCircle size={14} /> {uploadError}
              </div>
            )}

            {/* Success */}
            {uploadResult && (
              <div
                className="flex flex-col gap-2 px-4 py-3 rounded-xl fade-up"
                style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}
              >
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--green)" }}>
                  <CheckCheck size={15} /> Uploaded — permanent CDN link:
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono flex-1 truncate" style={{ color: "var(--text)" }}>
                    {uploadResult.url}
                  </span>
                  <CopyBtn text={uploadResult.url} />
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              {pendingFile && (
                <button
                  onClick={() => { setPendingFile(null); setCustomName(""); setUploadResult(null); setUploadError(""); }}
                  className="px-4 py-2.5 rounded-xl text-sm font-mono transition-all"
                  style={{ background: "var(--surface2)", color: "var(--muted)", border: "1px solid var(--border)" }}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => pendingFile && doUpload(pendingFile, customName)}
                disabled={!pendingFile || uploading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-mono font-semibold transition-all"
                style={{
                  background: pendingFile && !uploading
                    ? "linear-gradient(135deg, var(--accent), var(--accent2))"
                    : "var(--surface2)",
                  color: pendingFile && !uploading ? "#fff" : "var(--muted)",
                  cursor: !pendingFile || uploading ? "not-allowed" : "pointer",
                }}
              >
                {uploading ? (
                  <><RefreshCw size={15} className="spinner" /> Uploading…</>
                ) : (
                  <><Upload size={15} /> Upload to CDN</>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* File library */}
        <section className="fade-up flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono font-semibold text-sm" style={{ color: "var(--text)" }}>
              All Files
              <span className="ml-2 text-xs" style={{ color: "var(--muted)" }}>({files.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20" style={{ color: "var(--muted)" }}>
              <RefreshCw size={20} className="spinner mr-3" /> Loading…
            </div>
          ) : files.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-20 rounded-2xl"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <Upload size={32} style={{ color: "var(--muted)" }} />
              <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>No files yet — upload your first asset</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {files.map(f => (
                <FileCard key={f.filename} file={f} onDelete={deleteFile} onRename={renameFile} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
