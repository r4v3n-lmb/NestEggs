import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ command }) => {
  // Project Pages deployment for https://<user>.github.io/NestEggs/
  const base = command === "build" ? "/NestEggs/" : "/";

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: "prompt",
        includeAssets: ["icon-192.svg", "icon-512.svg"],
        manifest: {
          name: "NestEggs",
          short_name: "NestEggs",
          description: "Couples budgeting and financial planning",
          theme_color: "#0e2a47",
          background_color: "#f2f5f8",
          display: "standalone",
          start_url: base,
          icons: [
            {
              src: `${base}icon-192.svg`,
              sizes: "192x192",
              type: "image/svg+xml"
            },
            {
              src: `${base}icon-512.svg`,
              sizes: "512x512",
              type: "image/svg+xml"
            }
          ]
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
          globIgnores: ["**/20260409_0931_NestEggs App Logo_simple_compose_01knrjcdhpexntcsmjxq2w4n97.png"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "receipts-cache",
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                }
              }
            }
          ]
        }
      })
    ]
  };
});
