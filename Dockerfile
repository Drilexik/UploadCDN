# Stage 1 — build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2 — production image
FROM node:20-alpine
WORKDIR /app

# Install backend deps
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy backend source
COPY backend/server.js .

# Copy built frontend (served as static files from Express)
COPY --from=frontend-builder /build/frontend/dist ./public

# Create uploads directory (override with a volume in Dokploy)
RUN mkdir -p /app/uploads

# Serve the React build as static files
RUN npm install serve --omit=dev 2>/dev/null || true

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001
ENV UPLOADS_DIR=/app/uploads

CMD ["node", "server.js"]
