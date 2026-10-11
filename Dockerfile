# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack install && pnpm install --frozen-lockfile
COPY . .
ENV GLOVEBOX_STANDALONE=1
RUN pnpm build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates python3 python3-venv \
    && rm -rf /var/lib/apt/lists
COPY scripts/requirements.txt ./scripts/requirements.txt
RUN python3 -m venv /app/.venv \
    && /app/.venv/bin/pip install --no-cache-dir --only-binary=:all: -r scripts/requirements.txt

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    PYTHON=/app/.venv/bin/python \
    PYTHONDONTWRITEBYTECODE=1 \
    MANUALS_DATABASE_DIR=/app/database \
    TMPDIR=/app/tmp
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --chown=node:node scripts/extract.py ./scripts/extract.py
COPY --chown=node:node scripts/manual_extract ./scripts/manual_extract
RUN mkdir -p database tmp .next/cache \
    && chown node:node database tmp .next/cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health', {signal: AbortSignal.timeout(4000)}).then(async response => { if (!response.ok || (await response.json()).status !== 'ok') process.exit(1); }).catch(error => { console.error(error); process.exit(1); })"
CMD ["node", "server.js"]
