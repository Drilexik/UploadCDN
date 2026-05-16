# Stage 1 — build React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2 — production
FROM node:20-alpine
WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/server.js .
COPY --from=frontend-builder /build/frontend/dist ./public

RUN mkdir -p /app/uploads

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOADS_DIR=/app/uploads

CMD ["node", "server.js"]
