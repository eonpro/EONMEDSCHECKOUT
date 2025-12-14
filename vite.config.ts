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
