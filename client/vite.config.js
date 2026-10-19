import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // strictPort hace fallar el arranque si el puerto 5173 ya está ocupado,
    // en lugar de cambiar de puerto y romper el proxy de /api.
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: false, // no tocar el header Origin: lo necesita originCheck (CSRF)
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});