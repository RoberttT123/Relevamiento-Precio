import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      // ── Qué archivos cachear offline ──────────────────────────────────────
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
        // Las rutas del backend NO se cachean — siempre van a la red
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            // Cachear imágenes de Cloudinary para verlas offline
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "cloudinary-images",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
              },
            },
          },
          {
            // Las llamadas al backend van a la red; si falla, no cachear
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
        ],
      },

      // ── Manifest (cómo se ve la app en el celular) ────────────────────────
      manifest: {
        name: "Relevamiento de Precios — PROESA",
        short_name: "Relevamiento",
        description: "Sistema de relevamiento de precios PROESA",
        theme_color: "#1A1A2E",
        background_color: "#1A1A2E",
        display: "standalone",       // sin barra del navegador
        orientation: "portrait",     // siempre vertical en celular
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },

      // ── En desarrollo: mostrar el SW en consola ───────────────────────────
      devOptions: {
        enabled: true,
      },
    }),
  ],
});