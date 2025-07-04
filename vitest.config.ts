import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        restoreMocks: true,
        coverage: {
            reporter: ['text'],
            exclude: ['build/**'],
            include: ['sdk/**', 'flagsmith-engine/**']
        }
    }
});
