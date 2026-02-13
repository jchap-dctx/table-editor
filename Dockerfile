# ---------- Build App ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json .npmrc ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---------- Serve ----------
FROM node:22-alpine
WORKDIR /srv

RUN npm i express serve-static

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY server.mjs ./server.mjs
COPY --from=build /app/dist /srv/dist
USER nextjs

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
EXPOSE 3000

CMD ["node", "server.mjs"]