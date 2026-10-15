/** TailwindCSS 配置：统一浅色编辑器的设计变量 */
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../shared/src/**/*.{ts,tsx}',
    // 编辑器内嵌了 runtime 的播放器组件，它的类名也要参与生成
    '../runtime/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#eef2f7',
        panel: '#ffffff',
        line: '#e2e8f0',
        ink: {
          DEFAULT: '#1f2937',
          soft: '#4b5563',
          faint: '#94a3b8',
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: ['"Microsoft YaHei"', '"PingFang SC"', '"Hiragino Sans GB"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.06), 0 4px 14px rgba(15,23,42,.06)',
        pop: '0 8px 30px rgba(15,23,42,.18)',
      },
    },
  },
  plugins: [],
};
