# Frontend (Vite + React SPA) — build-only image.
# The compose entrypoint copies /app/dist into the shared volume Caddy serves.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Service URLs are baked into the bundle at build time.
ARG VITE_BACKEND_URL
ARG VITE_RAG_URL
ARG VITE_AGENT_URL
ARG VITE_SCANNER_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL \
    VITE_RAG_URL=$VITE_RAG_URL \
    VITE_AGENT_URL=$VITE_AGENT_URL \
    VITE_SCANNER_URL=$VITE_SCANNER_URL
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
CMD ["sleep", "infinity"]
