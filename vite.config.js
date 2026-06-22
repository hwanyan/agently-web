import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/agently/',
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // 与生产环境 Nginx 的 ^~ /api/agently/ 规则保持一致：去掉 /api/agently 前缀后转发到后端
      '/api/agently': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/agently/, '')
      }
    }
  }
})
