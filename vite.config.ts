import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => {
  // Set correct base path when deploying to GitHub Pages
  // Repo name: ascii-webcam-mirror
  const basePath = process.env.VITE_BASE || '/ascii-webcam-mirror/'
  return {
    plugins: [react()],
    base: basePath,
  }
})
