import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(path.resolve(__dirname, '../../migrations'))
      return {
        main: './src/index.ts',
        miniflare: {
          compatibilityDate: '2026-07-15',
          d1Databases: ['DB'],
          bindings: {
            ENVIRONMENT: 'production',
            DEVICE_REGISTRATION_SECRET: 'bootstrap-test-secret',
            TEST_MIGRATIONS: migrations,
          },
        },
      }
    }),
  ],
  test: {
    setupFiles: ['./test/setup.ts'],
  },
})
