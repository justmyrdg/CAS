import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 1201, strictPort: true },
  preview: { port: 1201, strictPort: true },
})
