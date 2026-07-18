# syntax=docker/dockerfile:1
#
# Build context is the REPO ROOT (see docker-compose.yml) so shared/ — the single
# source-of-truth wire contract — is available for the build's type check.

FROM node:26-alpine AS base
WORKDIR /app

# --- deps: install from the lockfile only ---
FROM base AS deps
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci

# --- build: compile the Next.js standalone bundle ---
FROM base AS build
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY shared ./shared
COPY web ./web
RUN cd web && npm run build

# --- runner: minimal production image ---
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -g 10001 -S nodejs && adduser -S -u 10001 -G nodejs nextjs

# Next infers the standalone root at /app/web (no parent workspace), so server.js,
# node_modules and .next land at the ROOT of .next/standalone.
COPY --from=build /app/web/.next/standalone ./
COPY --from=build /app/web/.next/static ./.next/static
COPY --from=build /app/web/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
