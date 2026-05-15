import "dotenv/config";

import express from "express";
import cors from "cors";
import translateRouter from "./routes/translate";
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

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const ok = ALLOWED_ORIGIN_PREFIXES.some((p) => origin.startsWith(p));
      if (ok) return callback(null, true);
      console.warn(`[cors] rejected origin: ${origin}`);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    maxAge: 86400,
  }),
);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/translate", translateRouter);

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

const server = app.listen(PORT, () => {
  console.log(
    `[server] backend started on http://localhost:${PORT}  (POST /api/translate)`,
  );
  // Warm the Google projectId cache so the first translate request
  // doesn't pay for ADC resolution.
  ensureProjectIdResolved().catch((err) => {
    console.error(
      "[server] projectId warm-up failed (translate calls will retry):",
      err,
    );
  });
});

/**
 * Graceful shutdown.
 *
 * Why: `ts-node-dev --respawn` (and Windows shells) sometimes leave the
 * previous child process holding port 3000 after Ctrl+C, which surfaces
 * as `EADDRINUSE :::3000` on the next start. Closing the HTTP server
 * (and force-exiting after a short grace window if any connection hangs)
 * makes the port reliably free.
 *
 * `SIGUSR2` is the signal ts-node-dev sends on restart — handling it lets
 * the dev-mode respawn cycle close the listener cleanly too.
 */
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
