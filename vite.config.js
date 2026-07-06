import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/agently/',
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // 与生产环境 Nginx 的 ^~ /api/agently/ + proxy_pass http://agently_backend/;
      // 保持一致：把 /api/agently/ 前缀剥离后转发给后端 grpc-gateway 原生的 /v1/... 路径
      // 例：/api/agently/v1/auth:login → http://localhost:8081/v1/auth:login
      '/api/agently': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/agently/, '')
      }
    }
  }
})
