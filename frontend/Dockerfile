# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

# ---- Dependencies ----
FROM base AS deps
RUN npm ci

# ---- Development ----
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---- Build ----
FROM base AS build
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Production ----
FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://localhost:80/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
