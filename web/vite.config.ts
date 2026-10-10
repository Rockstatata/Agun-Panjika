import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the site from /<repo>/; override with BASE=/ for a custom domain.
export default defineConfig({
  base: process.env.BASE ?? "./",
  plugins: [react()],
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 900,
  },
});
