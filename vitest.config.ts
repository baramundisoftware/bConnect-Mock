import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'build/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/generated/**',
        '**/*.config.ts',
        'scripts/',
        'src/index.ts', // process entry point — server startup, not unit-testable
        'src/generators/index.ts', // barrel re-export — no logic to test
        'src/routes/factories/index.ts', // barrel re-export — no logic to test
      ],
      // Coverage thresholds — ratchet at current measured levels
      // Measured post-Phase-20: lines 92.22%, statements 82.33%, branches 72.53%, functions 97.65%
      // Phase 20 coverage boost: branches improved from 67% → 72%+ via 180 new tests
      thresholds: {
        lines: 92,
        functions: 97,
        branches: 72,
        statements: 82,
      },
      all: true,
    },

    // Test files
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
    ],

    // Test timeout
    testTimeout: 10000,

    // Globals (optional, for describe/it/expect without imports)
    globals: false,

    // Parallel execution
    threads: true,
    maxThreads: 4,

    // Reporter
    reporters: ['verbose'],

    // Disable rate limiting during tests so performance/load tests are not throttled
    env: {
      RATE_LIMIT_ENABLED: 'false',
    },

    // Setup files
    setupFiles: [],
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});
