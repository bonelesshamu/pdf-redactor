import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.pdf'],
  worker: {
    format: 'es',
  },
  build: {
    sourcemap: true, // ✅ ソースマップを有効化
  },
});

