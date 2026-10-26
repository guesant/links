FROM rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667 AS actionlint
FROM ghcr.io/zizmorcore/zizmor:1.31.1@sha256:42d409dbb851d4c5d35a058cf042b828bea1e3f2884378c526eb0974780e18d9 AS zizmor
FROM lycheeverse/lychee:0.24.2@sha256:e2d19e57cf6ab037026f20b8e449a1f30d9d7f81eef4194763aab2eab20bd28d AS lychee
FROM docker:28.5.1-cli@sha256:9190b0613792e658a7783cf14b2d5ace5941bb68ede7276922ea36ee457d76ad AS docker-cli

FROM node:24.6.0-bookworm-slim AS workspace
ARG TARGETARCH
ARG HUGO_VERSION=0.168.0
ARG JUST_VERSION=1.59.0
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates chromium curl git libstdc++6 \
  && rm --recursive --force /var/lib/apt/lists/*
RUN set -eu; \
  build_arch="${TARGETARCH:-$(dpkg --print-architecture)}"; \
  case "$build_arch" in \
    arm64) hugo_sha=b975ba150a464f57115bdf6cbf6638224906461fdcf863821ec983f8602a442c; just_arch=aarch64; just_sha=23871b1702bfd550fb5f901778fd4290ecf2ee034a45a889fbe96d89b188086d ;; \
    amd64) hugo_sha=787f100057328824f38c6ad7c87ff10d6451ae0a7bc39cedaad0dd2bcde17e53; just_arch=x86_64; just_sha=409044617b6f06517c1035e55ca38c8c856ff8b650e41bc2aa1ef82d5903a23e ;; \
    *) exit 1 ;; \
  esac; \
  curl --fail --silent --show-error --location "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-${build_arch}.tar.gz" --output /tmp/hugo.tar.gz; \
  printf '%s  /tmp/hugo.tar.gz\n' "$hugo_sha" | sha256sum --check; \
  tar --extract --gzip --file /tmp/hugo.tar.gz --directory /usr/local/bin hugo; \
  curl --fail --silent --show-error --location "https://github.com/casey/just/releases/download/${JUST_VERSION}/just-${JUST_VERSION}-${just_arch}-unknown-linux-musl.tar.gz" --output /tmp/just.tar.gz; \
  printf '%s  /tmp/just.tar.gz\n' "$just_sha" | sha256sum --check; \
  tar --extract --gzip --file /tmp/just.tar.gz --directory /usr/local/bin just; \
  rm /tmp/hugo.tar.gz /tmp/just.tar.gz
ENV CHROME_PATH=/usr/bin/chromium
ENV NODE_PATH=/usr/local/lib/node_modules
ENV LINKS_CONTAINER=1
RUN npm install --global --no-fund --no-audit @lhci/cli@0.15.1 pa11y-ci@5.0.0 serve@14.2.4 prettier@3.6.2 yaml@2.9.1 @devcontainers/cli@0.89.0
COPY --from=actionlint /usr/local/bin/actionlint /usr/local/bin/actionlint
COPY --from=zizmor /usr/bin/zizmor /usr/local/bin/zizmor
COPY --from=lychee /usr/local/bin/lychee /usr/local/bin/lychee
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/ /usr/local/libexec/docker/cli-plugins/
WORKDIR /workspace
CMD ["sleep", "infinity"]
