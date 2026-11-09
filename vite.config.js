import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 后端 gyy-user-service 运行在 8101 端口
const BACKEND_TARGET = 'http://localhost:8101'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // 允许内网穿透隧道域名访问（trycloudflare.com 的随机子域名）
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      // 前端请求 /api/v1/** → 转发到后端服务
      '/api': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
    },
  },
})
