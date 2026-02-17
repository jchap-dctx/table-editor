# ---------- Build App ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json .npmrc ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---------- Serve ----------
FROM nginx:alpine
WORKDIR /srv

# Copy built static assets under /custom-elements path in Nginx web root
COPY --from=build /app/dist /usr/share/nginx/html/custom-elements

# Provide a non-root nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Run Nginx as non-root user
USER nginx

# Expose non-privileged port and run in foreground
EXPOSE 3000

ENTRYPOINT ["nginx", "-g", "daemon off;"]