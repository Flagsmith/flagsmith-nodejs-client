import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config for testing against the built ESM output.
 * This catches CJS/ESM interop issues (like jsonpath) that don't surface
 * when testing TypeScript source directly.
 *
 * Run with: npm run test:esm-build (after npm run build)
 */
export default defineConfig({
    test: {
        globals: true,
        restoreMocks: true,
        exclude: ['**/node_modules/**'],
        server: {
            deps: {
                // Don't transform built ESM - test it as-is
                external: [/build\/esm/]
            }
        }
    },
    resolve: {
        alias: {
            // Redirect source imports to built ESM output
            '../../../flagsmith-engine': path.resolve(__dirname, 'build/esm/flagsmith-engine'),
            '../../../../flagsmith-engine': path.resolve(__dirname, 'build/esm/flagsmith-engine'),
            '../../../sdk': path.resolve(__dirname, 'build/esm/sdk'),
            '../../../../sdk': path.resolve(__dirname, 'build/esm/sdk'),
            '../../sdk': path.resolve(__dirname, 'build/esm/sdk'),
            '../sdk': path.resolve(__dirname, 'build/esm/sdk')
        }
    }
});
