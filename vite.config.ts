import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { seoPages } from "./scripts/seo.js"

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), tailwindcss(), seoPages(), VitePWA({
    registerType: "prompt",
    injectRegister: false,
    manifest: {
      name: "Layout Forge",
      short_name: "Layout Forge",
      description: "36 free visual design and CSS tools, available offline.",
      theme_color: "#18181b",
      background_color: "#18181b",
      display: "standalone",
      start_url: ".",
      scope: ".",
      icons: [
        { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      maximumFileSizeToCacheInBytes: 5000000,
      navigateFallbackDenylist: [/\/tools\//],
      cleanupOutdatedCaches: true,
    },
  })],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})
