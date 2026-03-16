/// <reference types="vitest/config" />
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, UserConfig } from "vite";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default async function createConfig(): Promise<UserConfig> {
  const reactPlugins = react();
  const plugins: Plugin[] = Array.isArray(reactPlugins)
    ? reactPlugins
    : [reactPlugins];

  // Allow local development even when private package access is not configured.
  const hasUiFoundations = existsSync(
    path.resolve(__dirname, "node_modules/@dctx/ui-foundations"),
  );
  const hasKontentStylekit = existsSync(
    path.resolve(__dirname, "node_modules/@kontent-ai/stylekit"),
  );

  // basicSsl is optional in local fallback mode.
  if (process.env.NODE_ENV === "development") {
    try {
      const basicSslModule = await import("@vitejs/plugin-basic-ssl");
      plugins.push(
        basicSslModule.default({
          name: "localhost",
        }),
      );
    } catch {
      // Intentionally no-op: dev can run over HTTP if plugin isn't available.
    }
  }

  return {
    base: "/custom-elements",
    server: {
      host: true,
      allowedHosts: [".davecampbells.com"],
    },
    resolve: {
      alias: {
        ...(hasUiFoundations
          ? {}
          : {
              "@dctx/ui-foundations": path.resolve(
                __dirname,
                "src/shims/ui-foundations.tsx",
              ),
            }),
        ...(hasKontentStylekit
          ? {}
          : {
              "@kontent-ai/stylekit": path.resolve(
                __dirname,
                "src/shims/kontent-stylekit.ts",
              ),
            }),
      },
    },
    plugins,
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: [],
      coverage: { provider: "v8" },
    },
  };
}
