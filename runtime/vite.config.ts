import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const sharedSrc = fileURLToPath(new URL('../shared/src', import.meta.url));
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/**
 * 两种构建模式：
 * 1. 默认（tauri / 本地预览）：普通多文件产物，供 Tauri 打包 exe 使用
 * 2. web-export：单文件 IIFE 产物，双击 index.html 也能跑（可直接打包 zip 发给别人）
 */
export default defineConfig(({ mode }) => {
  const isWebExport = mode === 'web-export';

  return {
    plugins: [react()],
    base: './',
    resolve: {
      alias: {
        '@gal/shared': sharedSrc,
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5174,
      strictPort: true,
      fs: { allow: [repoRoot] },
    },
    build: {
      outDir: isWebExport ? 'dist-web' : 'dist',
      // 不清理输出目录：部分安全环境把删除转投回收站会失败，导致构建被中止；
      // 配合固定文件名（覆盖式写入），不清空也不会堆积旧文件
      emptyOutDir: false,
      target: 'es2019',
      cssCodeSplit: false,
      // Web 版把 CSS/小图全部内联，避免 file:// 下的跨目录请求问题
      assetsInlineLimit: isWebExport ? 100000000 : 4096,
      rollupOptions: isWebExport
        ? {
            output: {
              format: 'iife',
              inlineDynamicImports: true,
              entryFileNames: 'app.js',
              assetFileNames: '[name][extname]',
            },
          }
        : {
            // 默认构建也用固定文件名，每次构建直接覆盖旧产物，Tauri 打包不会积攒旧文件
            output: {
              entryFileNames: 'assets/[name].js',
              chunkFileNames: 'assets/[name].js',
              assetFileNames: 'assets/[name][extname]',
            },
          },
    },
  };
});
