# Drilex CDN

> Self-hosted CDN for logos, favicons and static assets — built with Next.js 14.

**upload.drilex.cz/logo.png** — permanent, public, instant.

---

## Features

- **Public landing page** with live URL preview
- **Password-protected admin panel** — upload, rename, delete files
- **Custom CDN slug** — you choose the filename before uploading
- **Permanent static URLs** — `https://upload.drilex.cz/anything.png`
- **Image previews** in the file manager
- **Drag & drop** or click-to-browse uploader
- **50 MB** max file size, any file type
- **Cache headers** — `immutable, max-age=31536000` on all CDN files
- **CORS enabled** — use links anywhere

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Runtime | Node.js 20 |
| Container | Docker (standalone build) |
| Deployment | Dokploy + Traefik |

---

## Project Structure

```
app/
├── page.js                     # Root page (server component)
├── CDNApp.js                   # Full UI — landing / login / admin
├── layout.js                   # HTML shell, favicon, fonts
├── globals.css                 # Purple theme, animations
├── api/
│   ├── upload/route.js         # POST /api/upload
│   ├── files/route.js          # GET  /api/files
│   └── files/[filename]/       # DELETE + PATCH /api/files/:filename
└── [...slug]/route.js          # CDN file serving — /logo.png etc.
lib/
└── storage.js                  # Shared helpers (auth, file ops, paths)
public/
├── logo.png                    # Drilex logo
└── favicon.png                 # Browser tab icon
```

---

## Environment Variables

Create a `.env` file (or set in Dokploy UI):

```env
# Password to access the admin panel
ADMIN_PASSWORD=your_secure_password_here

# Public base URL — used to generate CDN links
BASE_URL=https://upload.drilex.cz

# Port the server listens on
PORT=3000

# Where uploaded files are stored (map a Docker volume here!)
UPLOADS_DIR=/app/uploads
```

---

## Dokploy Deployment

### 1. Push to Git

```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/youruser/yourrepo.git
git push -u origin main
```

### 2. Create service in Dokploy

- **New Service → Application**
- Source: your Git repo
- Build type: **Dockerfile** (auto-detected)

### 3. Set environment variables

In Dokploy → your service → **Environment** tab:

```
ADMIN_PASSWORD=your_secure_password
BASE_URL=https://upload.drilex.cz
PORT=3000
UPLOADS_DIR=/app/uploads
```

### 4. Add a persistent volume

In Dokploy → **Mounts**:

| Field | Value |
|---|---|
| Type | Volume |
| Container path | `/app/uploads` |

> ⚠️ Without a volume, all uploaded files are deleted on every redeploy.

### 5. Configure domain

In Dokploy → **Domains**:

| Field | Value |
|---|---|
| Host | `upload.drilex.cz` |
| Container Port | `3000` |
| HTTPS | Enabled |
| Certificate | **None** (if using Cloudflare proxy) |

### 6. Cloudflare SSL

If your domain is proxied through Cloudflare (orange cloud):

- SSL/TLS → Overview → set to **Full**
- Do **not** use Let's Encrypt in Dokploy when Cloudflare proxy is enabled — they conflict

### 7. Deploy

Hit **Deploy** in Dokploy. Build takes ~60 seconds.

---

## Local Development

```bash
# Install dependencies
npm install

# Copy env
cp .env.example .env
# Edit .env — set ADMIN_PASSWORD, BASE_URL=http://localhost:3000

# Run dev server
npm run dev
# → http://localhost:3000
```

---

## Local Docker

```bash
cp .env.example .env

docker build -t drilex-cdn .

docker run -p 3000:3000 \
  -v $(pwd)/uploads:/app/uploads \
  --env-file .env \
  drilex-cdn
```

---

## API Reference

All write endpoints require the `x-admin-password` header.

### Upload file
```
POST /api/upload
Header: x-admin-password: <password>
Body: multipart/form-data
  file     — the file
  filename — (optional) custom CDN slug, e.g. "logo.png"
```
```json
{
  "success": true,
  "filename": "logo.png",
  "url": "https://upload.drilex.cz/logo.png",
  "size": 24891,
  "mimetype": "image/png"
}
```

### List files
```
GET /api/files
Header: x-admin-password: <password>
```

### Delete file
```
DELETE /api/files/:filename
Header: x-admin-password: <password>
```

### Rename file
```
PATCH /api/files/:filename
Header: x-admin-password: <password>
Body: { "newFilename": "new-name.png" }
```

### Serve CDN file (public)
```
GET /logo.png
GET /favicon.ico
GET /banner.webp
```
No auth required. Cached with `Cache-Control: public, max-age=31536000, immutable`.

---

## How CDN URLs Work

When you upload `logo.png` with the slug `logo.png`:

1. File is saved to `/app/uploads/logo.png`
2. Next.js catches `GET /logo.png` via the `[...slug]` route
3. File is streamed back with correct `Content-Type` and cache headers
4. URL is **permanent** as long as you don't delete or rename the file

```html
<!-- Use anywhere -->
<img src="https://upload.drilex.cz/logo.png" />
<link rel="icon" href="https://upload.drilex.cz/favicon.ico" />
<meta property="og:image" content="https://upload.drilex.cz/banner.png" />
```
