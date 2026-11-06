# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci
COPY src ./src
COPY service ./service
RUN npm run build:service
RUN npm prune --offline --omit=dev --ignore-scripts --no-audit \
    && mkdir -p /runtime/service /runtime/src/automation \
    && cp service/cli.mjs service/http.mjs service/mcp.mjs service/renderer.mjs /runtime/service/ \
    && cp src/automation/schema.ts /runtime/src/automation/ \
    && cp package.json package-lock.json /runtime/ \
    && mv node_modules dist-service /runtime/

FROM node:24-bookworm-slim
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export SSL_CERT_FILE=/run/secrets/proxy_ca; fi; \
    apt-get update && apt-get install -y --no-install-recommends chromium chromium-sandbox ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /runtime/ ./
COPY --chown=node:node LICENSE ./LICENSE
USER node
ENV NODE_ENV=production AVATAR_HOST=0.0.0.0 AVATAR_PORT=3000 AVATAR_CHROMIUM_PATH=/usr/bin/chromium
EXPOSE 3000
CMD ["node", "service/cli.mjs", "serve"]
