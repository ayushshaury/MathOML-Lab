# Multi-stage production Dockerfile for Render Backend
FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package.json ./
RUN npm install

# Copy source code and build TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production runtime image
FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=10000

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 10000

CMD ["node", "dist/server.js"]
