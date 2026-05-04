import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
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
})
