FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY server.cjs ./

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "server.cjs"]
