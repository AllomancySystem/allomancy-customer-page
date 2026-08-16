import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// HTTPS + a pinned port so the dev origin is a stable `https://localhost:5173`.
// That exact origin is what the merchant registers as the store's `CustomerPageOrigin`
// (the backend rejects non-https origins and only allows the registered one through CORS).
export default defineConfig({
  plugins: [react(), basicSsl(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
