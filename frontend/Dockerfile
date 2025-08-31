# multistage Dockerfile with dev and production targets using yarn

FROM node:18-alpine AS base
WORKDIR /app
COPY package.json ./
RUN corepack enable && yarn install --frozen-lockfile
COPY . .
# If host node_modules were accidentally copied into the context, remove them
# and reinstall inside the image to ensure native linux binaries (esbuild) are used.
RUN rm -rf node_modules || true && \
	corepack enable && yarn install --frozen-lockfile

# Development target
FROM base AS dev
ENV NODE_ENV=development
EXPOSE 3000 5173
CMD ["yarn", "dev"]

# Builder for production assets
FROM base AS builder
ENV NODE_ENV=production
RUN yarn build

# Production image serving static assets with nginx
FROM nginx:stable-alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
