FROM node:20-slim

WORKDIR /app

# Install dependencies first for layer caching
COPY package*.json ./
RUN npm install

# Copy project files
COPY . .

# Build Next.js application
RUN npm run build

# Web server port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode >= 400) process.exit(1);})" || exit 1

CMD ["npm", "start"]
