import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base relativa: el sitio funciona igual en la raíz de un dominio o en una subcarpeta.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { target: "es2022", sourcemap: false }
});
