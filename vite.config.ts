import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// No manualChunks. The inspector is lazy-imported, which already puts three.js in
// its own chunk. A manualChunks group for three looked like a safeguard but under
// Rolldown it also captures the group's dependencies -- React included -- so the
// main bundle ended up importing React from the three chunk and every page
// modulepreloaded 357 kB of WebGL it never used.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The three.js chunk is large by nature and only loads on live model pages.
    chunkSizeWarningLimit: 1400,
  },
})
