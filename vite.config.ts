/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Read version from package.json
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const versionName = pkg.version ?? '1.5.0'
const versionParts = versionName.split('.').map(Number)
const versionCode = versionParts[0] * 1000 + (versionParts[1] ?? 0) * 100 + (versionParts[2] ?? 0)

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(versionName),
    __APP_VERSION_CODE__: JSON.stringify(versionCode),
    __ACTICHAT_VERSION_CODE__: JSON.stringify(versionCode),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (
            id.includes('react-markdown') ||
            id.includes('remark-gfm') ||
            id.includes('remark-math') ||
            id.includes('rehype-katex')
          ) {
            return 'markdown'
          }
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
