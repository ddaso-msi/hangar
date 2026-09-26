import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // The inspector is already lazy-imported, so three.js lands in its own
        // chunk. Naming it explicitly keeps that guarantee if the import graph
        // ever changes: `/` must never pay for WebGL.
        manualChunks(id: string) {
          if (/node_modules\/(three|@react-three)\//.test(id)) return 'three'
        },
      },
    },
  },
})
