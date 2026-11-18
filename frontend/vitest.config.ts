import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'threads',
    isolate: true,
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
});
