# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the files
COPY . .

# Build the application
# We need to set build-time environment variables if any
# NEXT_PUBLIC_API_URL should be set here if it's baked in
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production

# Copy necessary files from builder
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["npm", "start"]
