# Stage 1: Build Frontend
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Server & Runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install server dependencies
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy server application code
COPY server/src/ ./src/

# Copy compiled frontend from client-builder stage into client/dist
WORKDIR /app
COPY --from=client-builder /app/client/dist ./client/dist

# Container security: run as unprivileged node user
USER node

WORKDIR /app/server
EXPOSE 4000

CMD ["node", "src/index.js"]
