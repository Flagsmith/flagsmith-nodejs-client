# Runs this SDK, built from source, under the Flagsmith SDK behavioural spec.
# docker build -f sdk-spec/Dockerfile --build-context harness=<sdk-spec>/harness/nodejs .
FROM docker.io/library/node:24-slim AS build

WORKDIR /sdk
COPY package.json package-lock.json tsconfig*.json .npmignore ./
# Skip the `prepare` script, which installs Git hooks.
RUN npm ci --ignore-scripts
COPY index.ts ./
COPY sdk ./sdk
COPY flagsmith-engine ./flagsmith-engine
RUN npm run build && npm pack --ignore-scripts --pack-destination /tmp

FROM docker.io/library/node:24-slim

WORKDIR /sdk
COPY --from=build /tmp/flagsmith-nodejs-*.tgz /tmp/
RUN npm install --no-save --no-audit --no-fund /tmp/flagsmith-nodejs-*.tgz && rm /tmp/*.tgz

COPY --from=harness harness.mts /harness/harness.mts
COPY sdk-spec/steps.mts ./sdk-spec/steps.mts

ENTRYPOINT ["node", "/harness/harness.mts", "sdk-spec/steps.mts"]
