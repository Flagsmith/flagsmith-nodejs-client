# Builds the SDK from source with the adapter for the Flagsmith SDK behavioural spec.
# Build from the repository root: docker build -f spec-adapter/Dockerfile .
FROM node:24-slim AS build

WORKDIR /sdk
COPY package.json package-lock.json tsconfig*.json .npmignore ./
# Skip the `prepare` script, which installs Git hooks.
RUN npm ci --ignore-scripts
COPY index.ts ./
COPY sdk ./sdk
COPY flagsmith-engine ./flagsmith-engine
RUN npm run build && npm pack --ignore-scripts --pack-destination /tmp

FROM node:24-slim

WORKDIR /adapter
COPY --from=build /tmp/flagsmith-nodejs-*.tgz /tmp/
RUN npm install --no-save --no-audit --no-fund /tmp/flagsmith-nodejs-*.tgz && rm /tmp/*.tgz

COPY spec-adapter/adapter.mts ./

ENV PORT=8080
EXPOSE 8080
CMD ["node", "adapter.mts"]
