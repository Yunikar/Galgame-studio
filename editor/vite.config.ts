import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const sharedSrc = fileURLToPath(new URL('../shared/src', import.meta.url));
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@gal/shared': sharedSrc,
      // 编辑器内嵌 runtime 的播放器组件，用于底部实时预览
      '@runtime': fileURLToPath(new URL('../runtime/src', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // 允许读取仓库根目录（shared 在 editor 之外）
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: 'dist',
    // 不清理输出目录：部分安全环境把删除转投回收站会失败，导致构建被中止；
    // 固定文件名 + 覆盖式写入，不清空也不会堆积旧文件（public/runtime-web 也不会被误删）
    emptyOutDir: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
