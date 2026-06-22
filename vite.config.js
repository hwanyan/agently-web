import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/agently/',
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // 与生产环境 Nginx 的 ^~ /api/agently/ 规则保持一致：原样转发到后端
      // 后端自身已经注册 /api/agently/... 前缀的路由，所以这里不做 rewrite
      '/api/agently': {
        target: 'http://localhost:8081',
        changeOrigin: true
      }
    }
  }
})
