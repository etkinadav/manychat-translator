import "dotenv/config";

import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import translateRouter from "./routes/translate";
import userRouter from "./routes/user";
import { connectMongo } from "./db/mongoose";
import { ensureProjectIdResolved } from "./services/googleTranslate.service";

const PORT = Number(process.env.PORT ?? 3000);

const app = express();

/**
 * CORS policy:
 *  - `chrome-extension://` — background service worker fetch (preferred).
 *  - `https://app.manychat.com` — content-script fetch runs in the page
 *    context, so the browser sends this Origin on preflight (see MV3 note).
 *  - localhost — curl / local dev tabs.
 *  - No Origin — curl, server-to-server.
 */
const ALLOWED_ORIGIN_PREFIXES = [
  "chrome-extension://",
  "https://app.manychat.com",
  "http://localhost",
  "http://127.0.0.1",
];

const FRONTEND_DEV_ORIGINS = (
  process.env.FRONTEND_DEV_ORIGINS ?? "http://localhost:5173"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const ok =
        ALLOWED_ORIGIN_PREFIXES.some((p) => origin.startsWith(p)) ||
        FRONTEND_DEV_ORIGINS.includes(origin);
      if (ok) return callback(null, true);
      console.warn(`[cors] rejected origin: ${origin}`);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/translate", translateRouter);
app.use("/api/user", userRouter);

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
  console.log(`[server] serving frontend from ${frontendDist}`);
}

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction,
  ) => {
    console.error("[server] unhandled error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  },
);

async function startServer(): Promise<void> {
  try {
    await connectMongo();
  } catch (err) {
    console.error("[server] MongoDB connection failed:", err);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(
      `[server] backend started on http://localhost:${PORT}`,
    );
    console.log(
      `[server] routes: POST /api/translate, POST /api/user/login, GET /api/user/me`,
    );
    ensureProjectIdResolved().catch((err) => {
      console.error(
        "[server] projectId warm-up failed (translate calls will retry):",
        err,
      );
    });
  });

  registerGracefulShutdown(server);
}

function registerGracefulShutdown(
  server: ReturnType<typeof app.listen>,
): void {
  const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM", "SIGUSR2"] as const;
  let shuttingDown = false;

  function gracefulShutdown(signal: string): void {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] received ${signal}, shutting down`);

    const forceExit = setTimeout(() => {
      console.warn("[server] forced exit after 3s grace");
      process.exit(0);
    }, 3000);
    forceExit.unref();

    server.close((err) => {
      if (err) {
        console.error("[server] error during close:", err);
        process.exit(1);
      }
      console.log("[server] closed cleanly");
      process.exit(0);
    });
  }

  for (const sig of SHUTDOWN_SIGNALS) {
    process.on(sig, () => gracefulShutdown(sig));
  }
}

void startServer();
