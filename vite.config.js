import { defineConfig } from 'vite'
import { resolve } from 'path'

const API_TARGET = process.env.API_PROXY || 'http://127.0.0.1:8788'

export default defineConfig({
  // 生产由 Express 挂在站点根路径；绝对 base 避免 /about/ 下脚本变成 /about/assets/*
  base: '/',
  server: {
    port: 5174,
    open: '/admin.html',
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/health': { target: API_TARGET, changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/health': { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        service: resolve(__dirname, 'service.html'),
        about: resolve(__dirname, 'about.html'),
        news: resolve(__dirname, 'news.html'),
        newsDetail: resolve(__dirname, 'news-detail.html'),
        case: resolve(__dirname, 'case.html'),
        caseDetail: resolve(__dirname, 'case-detail.html'),
        contact: resolve(__dirname, 'contact.html'),
        page: resolve(__dirname, 'page.html'),
        admin: resolve(__dirname, 'admin.html'),
        liveDetail: resolve(__dirname, 'live-detail.html'),
        mcnCaseDetail: resolve(__dirname, 'mcn-case-detail.html'),
        talentDetail: resolve(__dirname, 'talent-detail.html'),
      },
    },
  },
})
