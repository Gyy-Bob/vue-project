import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 前端统一走 8080 网关（JWT 鉴权在网关层），由网关路由到 8101 等业务服务
// 注意：不要直连 8101，否则会绕过网关的 JWT 校验
const BACKEND_TARGET = 'http://localhost:8080'

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
