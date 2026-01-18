import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern"
      }
    }
  },
  resolve: {
      alias: {
        "@assets": path.resolve(__dirname, "src/assets"),
        "@features": path.resolve(__dirname, "src/features"),
        "@shared": path.resolve(__dirname, "src/shared"),
        "@types": path.resolve(__dirname, "src/types.ts")
      }
    },
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg"]
  },
  build: {
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      onwarn(warning, warn) {
        if (typeof warning.message === "string" && warning.message.includes("contains an annotation that Rollup cannot interpret")) {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
              return "react";
            }
            if (id.includes("node_modules/react-router")) {
              return "router";
            }
            if (id.includes("node_modules/ethers/")) {
              return "ethers";
            }
          }
          return undefined;
        }
      }
    }
  }
});
