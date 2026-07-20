# Backend (Node + TypeScript + Express) — port 5000
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# Keep dev deps so `npm run seed` (tsx src/scripts/seed.ts) works in-container.
RUN npm ci
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
EXPOSE 5000
CMD ["node", "dist/index.js"]
