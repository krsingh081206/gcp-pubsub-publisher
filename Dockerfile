# --- Stage 1: Builder ---
# This stage installs dependencies and builds the application
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

# Copy package files and install production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# --- Stage 2: Production ---
# This stage creates the final, lean production image
FROM node:18-alpine
WORKDIR /usr/src/app

# Create a non-root user for better security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy dependencies from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy application code
COPY index.js .

# Command to run the application
CMD ["node", "index.js"]