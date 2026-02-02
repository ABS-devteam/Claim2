import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // 1️⃣ Serve static files AND allow dotfiles (.well-known)
  app.use(
    express.static(distPath, {
      dotfiles: "allow",
    })
  );

  // 2️⃣ IMPORTANT: do NOT hijack /.well-known with SPA fallback
  app.use((req, res, next) => {
    if (req.path.startsWith("/.well-known")) {
      return next();
    }
    return res.sendFile(path.resolve(distPath, "index.html"));
  });
}
