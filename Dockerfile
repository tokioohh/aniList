# syntax=docker/dockerfile:1

# ---------- Etapa 1: build del frontend ----------
FROM node:24-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build                       # genera /app/client/dist

# ---------- Etapa 2: dependencias del backend + Prisma Client ----------
FROM node:24-alpine AS server-deps
RUN apk add --no-cache openssl
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev                   # "prisma" va en dependencies para poder migrar al iniciar
COPY server/prisma ./prisma
RUN npx prisma generate

# ---------- Etapa 3: imagen final ----------
FROM node:24-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=server-deps --chown=node:node /app/server/node_modules ./node_modules
COPY --chown=node:node server/package*.json ./
COPY --chown=node:node server/prisma ./prisma
COPY --chown=node:node server/src ./src
COPY --from=client-build --chown=node:node /app/client/dist ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "src/index.js"]