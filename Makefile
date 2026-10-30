SDK_BENCHMARKS := tests/engine/engine-tests/sdk-benchmarks

$(SDK_BENCHMARKS)/environments:
	git submodule update --init -- $(SDK_BENCHMARKS)

node_modules/.package-lock.json: package-lock.json
	npm ci

.PHONY: benchmark
benchmark: node_modules/.package-lock.json | $(SDK_BENCHMARKS)/environments
	SDK_BENCHMARKS_DIR=$(SDK_BENCHMARKS) npx vitest bench --run --config vitest.config.benchmark.ts
