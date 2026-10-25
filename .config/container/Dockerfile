FROM ghcr.io/gohugoio/hugo:v0.168.0@sha256:1fb8fe7f417abd5802d86747d297728aa48078d763159e7dff6559fe3f8bb8e7 AS site

WORKDIR /src
COPY . .

FROM node:24.6.0-bookworm-slim AS quality
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates chromium curl \
  && rm --recursive --force /var/lib/apt/lists/*
ENV CHROME_PATH=/usr/bin/chromium
RUN npm install --global --no-fund --no-audit @lhci/cli@0.15.1 pa11y-ci@5.0.0 serve@14.2.4
WORKDIR /work

FROM site AS final
