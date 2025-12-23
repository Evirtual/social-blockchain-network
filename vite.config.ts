import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    css: true,
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["test/**", "node_modules/**", "dist/**"]
  }
});
