# -------- Builder stage --------
FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build 

# -------- Runtime stage --------
FROM node:20-slim

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update \
    && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*

# Copy only needed files
COPY --from=builder /app ./

# Remove dev dependencies
RUN npm install --omit=dev

# Create non-root user
RUN useradd -m myuser \
    && chown -R myuser:myuser /app

USER myuser

EXPOSE 3000

CMD ["npm", "start"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
