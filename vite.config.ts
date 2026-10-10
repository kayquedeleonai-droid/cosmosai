import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], build: { rollupOptions: { output: { manualChunks(id) { if (id.includes('node_modules') && (id.includes('firebase') || id.includes('@firebase'))) return 'firebase'; if (id.includes('node_modules') && (id.includes('@xyflow') || id.includes('d3-'))) return 'canvas'; } } } } });
