import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      }
    }
  },
  // Teste local da build contra a API de produção (sem CORS): VITE_API_URL=/api
  preview: {
    proxy: {
      '/api': { target: 'https://api.cometapresentes.com.br', changeOrigin: true, secure: true },
    },
  },
  assetsInclude: ['**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.webp'],
})