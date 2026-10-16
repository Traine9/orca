# Build image for the fork's Linux .deb: Debian trixie (the host's glibc, so host-installed
# node_modules natives run) and Node 24 with corepack's pnpm. The build starts Electron headless to
# check that native modules load, so Electron's runtime libraries are installed too.
FROM node:24-trixie
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgtk-3-0 libgbm1 \
      libasound2 libxss1 libxtst6 libxkbcommon0 libsecret-1-0 xvfb \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
