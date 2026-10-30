FROM rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667 AS actionlint
FROM ghcr.io/zizmorcore/zizmor:1.31.1@sha256:42d409dbb851d4c5d35a058cf042b828bea1e3f2884378c526eb0974780e18d9 AS zizmor
FROM lycheeverse/lychee:0.24.2@sha256:e2d19e57cf6ab037026f20b8e449a1f30d9d7f81eef4194763aab2eab20bd28d AS lychee
FROM docker:28.5.1-cli@sha256:9190b0613792e658a7783cf14b2d5ace5941bb68ede7276922ea36ee457d76ad AS docker-cli
FROM hadolint/hadolint:v2.15.1@sha256:32dac94127fd60b7b7e3fbfc65e1383b9b5e25c9bfd7b8536de7a539fe68a12d AS hadolint
FROM zricethezav/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f AS gitleaks
FROM ghcr.io/google/osv-scanner:v2.5.1@sha256:8108ae94eadea5a02c9bec6e646909d5b790b44bd62d7f5b7f0b1d6d0ffc7734 AS osv-scanner
FROM aquasec/trivy:0.74.0@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969 AS trivy

FROM node:24.6.0-bookworm-slim AS workspace
ARG TARGETARCH
ARG JUST_VERSION=1.59.0
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates chromium curl git libstdc++6 optipng python3 python3-venv \
  && rm --recursive --force /var/lib/apt/lists/*
RUN set -eu; \
  case "${TARGETARCH:-$(dpkg --print-architecture)}" in \
    arm64) just_arch=aarch64; just_sha=23871b1702bfd550fb5f901778fd4290ecf2ee034a45a889fbe96d89b188086d ;; \
    amd64) just_arch=x86_64; just_sha=409044617b6f06517c1035e55ca38c8c856ff8b650e41bc2aa1ef82d5903a23e ;; \
    *) exit 1 ;; \
  esac; \
  curl --fail --silent --show-error --location "https://github.com/casey/just/releases/download/${JUST_VERSION}/just-${JUST_VERSION}-${just_arch}-unknown-linux-musl.tar.gz" --output /tmp/just.tar.gz; \
  printf '%s  /tmp/just.tar.gz\n' "$just_sha" | sha256sum --check; \
  tar --extract --gzip --file /tmp/just.tar.gz --directory /usr/local/bin just; \
  rm /tmp/just.tar.gz
ENV CHROME_PATH=/usr/bin/chromium
ENV NODE_PATH=/usr/local/lib/node_modules
ENV LINKS_CONTAINER=1
RUN npm install --global --no-fund --no-audit @ast-grep/cli@0.45.3 @lhci/cli@0.15.1 markdownlint-cli2@0.23.3 pa11y-ci@5.0.0 serve@14.2.4 prettier@3.6.2 yaml@2.9.1 @devcontainers/cli@0.89.0
RUN python3 -m venv /opt/quality-tools \
  && /opt/quality-tools/bin/pip install --no-cache-dir semgrep==1.151.0 yamllint==1.38.0 \
  && ln --symbolic /opt/quality-tools/bin/semgrep /usr/local/bin/semgrep \
  && ln --symbolic /opt/quality-tools/bin/yamllint /usr/local/bin/yamllint
COPY --from=actionlint /usr/local/bin/actionlint /usr/local/bin/actionlint
COPY --from=zizmor /usr/bin/zizmor /usr/local/bin/zizmor
COPY --from=lychee /usr/local/bin/lychee /usr/local/bin/lychee
COPY --from=hadolint /bin/hadolint /usr/local/bin/hadolint
COPY --from=gitleaks /usr/bin/gitleaks /usr/local/bin/gitleaks
COPY --from=osv-scanner /osv-scanner /usr/local/bin/osv-scanner
COPY --from=trivy /usr/local/bin/trivy /usr/local/bin/trivy
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/ /usr/local/libexec/docker/cli-plugins/
WORKDIR /workspace
CMD ["sleep", "infinity"]
