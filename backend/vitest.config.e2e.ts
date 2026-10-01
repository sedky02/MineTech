import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: loadEnv('test', process.cwd(), ''),
    globalSetup: ['./test/global-setup.ts'],
    // Tests share one database.
    fileParallelism: false,
    hookTimeout: 30_000,
  },
});
