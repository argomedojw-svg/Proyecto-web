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
  // Sin puerto fijo: la aplicación es estática y local, no depende de ningún
  // puerto concreto (no hay OAuth, ni webhooks, ni CORS). Si el entorno define
  // PORT se respeta; si no, Vite elige uno libre.
  server: { port: process.env.PORT ? Number(process.env.PORT) : undefined },
  preview: { port: process.env.PORT ? Number(process.env.PORT) : undefined },
});
