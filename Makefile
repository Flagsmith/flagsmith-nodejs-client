SDK_BENCHMARKS := tests/engine/engine-tests/sdk-benchmarks

$(SDK_BENCHMARKS)/environments:
	git submodule update --init -- $(SDK_BENCHMARKS)

node_modules/.package-lock.json: package-lock.json
	npm ci

.PHONY: benchmark benchmark-build benchmark-run
benchmark:
	$(MAKE) benchmark-build
	$(MAKE) benchmark-run

# Kept apart from benchmark-run: CodSpeed's simulation mode runs its whole command under Valgrind
benchmark-build: node_modules/.package-lock.json | $(SDK_BENCHMARKS)/environments

benchmark-run: | $(SDK_BENCHMARKS)/environments
	SDK_BENCHMARKS_DIR=$(SDK_BENCHMARKS) npx vitest bench --run --config vitest.config.benchmark.ts
