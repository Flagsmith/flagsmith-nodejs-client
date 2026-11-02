import codspeedPlugin from '@codspeed/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [codspeedPlugin()],
    test: {
        execArgv: ['--always-sparkplug'], // Compile baseline code up front, not within CodSpeed's single measured call
        benchmark: {
            include: ['benchmarks/**/*.bench.ts']
        }
    }
});
