# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ .
RUN npm run build

# Stage 2: Setup Backend & Serve
FROM node:20-alpine
WORKDIR /app

# Install backend dependencies
COPY server/package*.json ./
RUN npm install --production

# Copy backend source code
COPY server/ .

# Copy built frontend assets to server's public directory
COPY --from=frontend-builder /app/client/dist ./public

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "app.js"]
