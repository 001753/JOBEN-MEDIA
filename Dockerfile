# ============================================================
# Dockerfile — JOBEN NEWS Strapi v5 Backend
# Multi-stage build untuk production (Google Cloud / VPS)
#
# CATATAN: File ini untuk migrasi ke cloud di masa depan.
# Development & deployment saat ini via cPanel Node.js Selector.
# Lihat MIGRATION.md untuk panduan penggunaan.
# ============================================================

# ── Stage 1: Builder ──────────────────────────────────────────
FROM node:20-alpine AS builder

# Install build tools yang diperlukan untuk native modules (better-sqlite3, dll)
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Copy package files dulu untuk memanfaatkan Docker layer cache
COPY package*.json ./

# Install semua dependencies (termasuk devDependencies untuk build)
RUN npm ci

# Copy source code
COPY . .

# Build Strapi admin panel (production)
RUN NODE_ENV=production npm run build

# ── Stage 2: Runner ───────────────────────────────────────────
FROM node:20-alpine AS runner

# Install runtime dependencies yang diperlukan (misal: untuk PostgreSQL client)
RUN apk add --no-cache libc6-compat dumb-init

# Buat user non-root untuk keamanan
RUN addgroup --system --gid 1001 strapi \
 && adduser  --system --uid  1001 strapi

WORKDIR /app

# Copy hanya production dependencies dari stage builder
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy hasil build dan source yang diperlukan
COPY --from=builder --chown=strapi:strapi /app/build        ./build
COPY --from=builder --chown=strapi:strapi /app/config       ./config
COPY --from=builder --chown=strapi:strapi /app/src          ./src
COPY --from=builder --chown=strapi:strapi /app/server.js    ./server.js
COPY --from=builder --chown=strapi:strapi /app/public       ./public

# Buat folder .tmp dan uploads dengan permissions yang benar
# (untuk SQLite dev / log temp — di production pakai PostgreSQL + R2)
RUN mkdir -p .tmp public/uploads \
 && chown -R strapi:strapi .tmp public/uploads

USER strapi

# Port dari environment variable (bukan hardcode — Passenger/Cloud Run set ini)
EXPOSE ${PORT:-1337}

# dumb-init mencegah zombie processes dan menangani signal dengan benar
ENTRYPOINT ["dumb-init", "--"]

# Gunakan server.js (kompatibel cPanel Passenger + Cloud Run)
CMD ["node", "server.js"]
