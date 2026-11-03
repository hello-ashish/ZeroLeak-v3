# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

# ---- Dependencies ----
FROM base AS deps
# Install dependencies needed for native modules (bcrypt)
RUN apk add --no-cache python3 make g++
RUN npm ci

# ---- Development ----
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health > /dev/null 2>&1 || exit 1
CMD ["npm", "run", "start"]
