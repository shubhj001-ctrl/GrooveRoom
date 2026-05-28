# Use official Node.js runtime as a parent image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy full source
COPY . .

# Run production compilation
RUN npm run build

# Expose port (Cloud Run sets PORT env variable, defaulting to port 3000 here)
EXPOSE 3000

# Start server
CMD ["npm", "start"]
