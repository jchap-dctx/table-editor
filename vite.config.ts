/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// https://vite.dev/config/
export default defineConfig({
  base: "/custom-elements",
  server: {
    host: true,
    allowedHosts: [".davecampbells.com"],
  },
  plugins: [
    react(),
    // Only use basicSsl in development
    ...(process.env.NODE_ENV === "development"
      ? [
          basicSsl({
            name: "localhost",
          }),
        ]
      : []),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    coverage: { provider: "v8" },
  },
});
