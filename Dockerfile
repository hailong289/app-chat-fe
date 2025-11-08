FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080

# Install dependencies (include dev deps for build)
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copy source and build
COPY . .
RUN npm run build

EXPOSE 8080
CMD ["sh","-c","npm run start -- -p ${PORT:-8080}"]


