# Build stage: install dependencies and build the frontend.
FROM --platform=$BUILDPLATFORM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json tsconfig.json tsconfig.frontend.json vite.config.ts ./
COPY shared ./shared
COPY backend ./backend
COPY frontend ./frontend
RUN pnpm build && pnpm prune --prod

# Runtime stage: distroless Node, no shell. The health check is the app itself.
FROM gcr.io/distroless/nodejs24-debian12:nonroot
WORKDIR /app
ENV NODE_ENV=production PORT=8080 STATIC_DIR=/app/frontend/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/shared ./shared
COPY --from=build /app/backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist
USER nonroot
EXPOSE 8080
HEALTHCHECK CMD ["/nodejs/bin/node", "backend/src/main.ts", "health"]
CMD ["backend/src/main.ts"]
