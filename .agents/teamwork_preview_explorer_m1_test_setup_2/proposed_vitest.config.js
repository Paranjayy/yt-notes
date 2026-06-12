import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom', // Provides a browser-like DOM environment for unit testing helper functions
    globals: true, // Allows using describe, test, expect without explicit imports
  },
});
