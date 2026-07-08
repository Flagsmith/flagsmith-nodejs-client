import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        restoreMocks: true,
        clearMocks: true,
        setupFiles: ['./tests/setup.ts'],
        coverage: {
            reporter: ['text'],
            exclude: ['build/**'],
            include: ['sdk/**', 'flagsmith-engine/**']
        }
    }
});
