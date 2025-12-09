# Multi-stage build for Lily's Dog Boarding App

# Stage 1: Build client
FROM node:20-alpine AS client-build
WORKDIR /app/client

# Accept build arguments for Vite
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Server
FROM node:20-alpine
WORKDIR /app

# Copy server files
COPY server/package*.json ./
RUN npm ci --production
COPY server/ ./

# Copy built client from stage 1
COPY --from=client-build /app/client/dist ./client/dist

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "server.js"]
