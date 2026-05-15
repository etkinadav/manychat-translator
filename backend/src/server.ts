import express from "express";
import cors from "cors";
import translateRouter from "./routes/translate";

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

app.listen(PORT, () => {
  console.log(
    `[server] backend started on http://localhost:${PORT}  (POST /api/translate)`,
  );
});
