import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const resolvedPort = Number(process.env.PORT) || 4001;
const useStrictPort = !process.env.PORT;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: resolvedPort,
    strictPort: useStrictPort,
  },
});
// Rebuild trigger: Wed Dec 17 14:33:06 EST 2025
// New keys: Wed Dec 17 17:49:40 EST 2025
