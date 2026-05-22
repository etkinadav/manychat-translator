import fs from "fs";
import path from "path";
import express from "express";
import { corsMiddleware } from "./middleware/cors.middleware";
import { errorHandler } from "./middleware/error-handler.middleware";
import translateRoutes from "./routes/translate";
import userRoutes from "./routes/user";
import organizationsRoutes from "./routes/organizations";
import websitesRoutes from "./routes/websites";

const app = express();

app.use(corsMiddleware);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/translate", translateRoutes);
app.use("/api/user", userRoutes);
app.use("/api/organizations", organizationsRoutes);
app.use("/api/websites", websitesRoutes);

/** Built frontend (`frontend/dist`) — open http://localhost:3000/ for login UI */
function resolveFrontendDist(): string | null {
  const candidates = [
    path.join(__dirname, "..", "..", "frontend", "dist"),
    path.join(process.cwd(), "frontend", "dist"),
    path.join(process.cwd(), "..", "frontend", "dist"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

const frontendDist = resolveFrontendDist();
if (frontendDist) {
  app.use(express.static(frontendDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
  console.log(`[app] serving frontend from ${frontendDist}`);
}

app.use(errorHandler);

export default app;
