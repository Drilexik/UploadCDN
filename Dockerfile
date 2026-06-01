FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy standalone Next.js build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Create uploads dir and the Next.js cache mountpoint (the latter is backed by
# a tmpfs at runtime, since the root filesystem is read-only).
RUN mkdir -p /app/uploads /app/.next/cache \
  && chown -R nextjs:nodejs /app/uploads /app/.next/cache \
  && chmod 755 /app/uploads

# Set secure environment.
# HOSTNAME=0.0.0.0 makes the Next standalone server bind to all interfaces.
# Without it, Docker sets HOSTNAME to the container ID and the server binds only
# to that hostname, so localhost healthchecks are refused.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV UPLOADS_DIR=/app/uploads
ENV NODE_ENV=production

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Healthcheck must drain the response and exit explicitly, otherwise the node
# process hangs on the open socket until the timeout and is reported unhealthy.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000',r=>{r.resume();process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
