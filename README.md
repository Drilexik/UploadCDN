# Drilex CDN

A self-hosted CDN for logos, favicons, and static assets.
Admin panel at `upload.drilex.cz` — files served at `upload.drilex.cz/filename.ext`.

## Features

- Password-protected admin panel (set via `.env`)
- Custom CDN filename on upload — choose `logo.png`, `favicon.ico`, etc.
- Permanent static URLs: `https://upload.drilex.cz/logo.png`
- Rename files (changes the URL slug)
- Delete files
- Image previews in the file manager
- Persistent storage via Docker volume

---

## Dokploy Deployment

### 1. Push to a Git repo (GitHub, Gitea, etc.)

### 2. In Dokploy → New Service → Application

- **Source**: your git repo
- **Build type**: Dockerfile (auto-detected)

### 3. Environment Variables (set in Dokploy UI)

| Variable | Example | Description |
|---|---|---|
| `ADMIN_PASSWORD` | `my_secure_pass` | Password to access the admin panel |
| `BASE_URL` | `https://upload.drilex.cz` | Public domain — used in CDN links |
| `PORT` | `3001` | Internal port |
| `UPLOADS_DIR` | `/app/uploads` | Where files are stored (use a volume!) |

### 4. Persistent Volume

In Dokploy → Mounts, add a volume:
- **Container path**: `/app/uploads`
- **Type**: Volume (so files survive redeploys)

### 5. Domain

Add `upload.drilex.cz` → port `3001` in Dokploy's domain settings.
Enable HTTPS (Let's Encrypt).

---

## Local Development

```bash
# Backend
cd backend
cp .env.example .env   # edit ADMIN_PASSWORD etc.
npm install
npm run dev            # runs on :3001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev            # runs on :5173, proxies /api to :3001
```

## Local Docker

```bash
cp backend/.env.example .env
docker compose up --build
# Visit http://localhost:3001
```

---

## How CDN URLs Work

When you upload `logo.png` to the admin panel:
- The file is saved to `/app/uploads/logo.png`
- Express serves it at `https://upload.drilex.cz/logo.png`
- This URL is **permanent** as long as you don't delete/rename the file

You can use these URLs directly in `<img>`, CSS, etc.:
```html
<img src="https://upload.drilex.cz/logo.png" />
<link rel="icon" href="https://upload.drilex.cz/favicon.ico" />
```
