import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // Rutas relativas: la app se sirve desde un servidor estatico local y no
  // asume estar en la raiz del dominio.
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    // El contenido va en public/dsm y NO se empaqueta: se edita un JSON,
    // se recarga y no hay que recompilar.
    assetsInlineLimit: 0,
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
