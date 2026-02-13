// server.mjs
import expressPkg from "express";
import serveStaticPkg from "serve-static";
import path from "path";
import { fileURLToPath } from "url";

const express = expressPkg.default ?? expressPkg;
const serveStatic = serveStaticPkg.default ?? serveStaticPkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

// Absolute path to Vite build output
const distPath = path.join(__dirname, "dist");

// Health check & default landing: redirect / → /custom-elements/
app.get("/", (_req, res) => res.redirect(302, "/custom-elements/"));

/**
 * Serve the built Vite app under /custom-elements
 * and let serve-static handle /custom-elements → /custom-elements/
 */
app.use(
  "/custom-elements",
  serveStatic(distPath, {
    index: ["index.html"],
    redirect: true, // handles /custom-elements → /custom-elements/
    fallthrough: false, // avoid falling back to HTML for missing JS/CSS
    setHeaders(res, filePath) {
      // Cache static assets, but not HTML
      if (/\.(js|css|woff2?|ttf|eot|svg)$/.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (/\.html$/.test(filePath)) {
        res.setHeader("Cache-Control", "no-store");
      }
    },
  }),
);

// Explicit 404 for anything else
app.use((_, res) => res.status(404).send("Not Found"));

app.listen(PORT, HOST, () => {
  console.log(`Vite build served at http://${HOST}:${PORT}/custom-elements`);
});
