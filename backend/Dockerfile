# Base imgae 
FROM node:25

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# create non-root user
RUN useradd -m myuser       
# change ownership of the app directory
RUN chown -R myuser:myuser /app
# switch to non-root user
USER myuser

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -f http://localhost:3000/health || exit 1