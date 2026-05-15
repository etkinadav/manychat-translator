import express from "express";
import cors from "cors";
import translateRouter from "./routes/translate";

const PORT = Number(process.env.PORT ?? 3000);

const app = express();

/**
 * CORS policy:
 *  - Allow any Chrome extension origin (`chrome-extension://<id>`) since
 *    the extension ID is unstable while we develop unpacked.
 *  - Allow any localhost origin (any port) so we can test the API from
 *    curl / a browser tab during development.
 *  - Allow requests with no Origin header (e.g. curl, server-to-server).
 */
const ALLOWED_ORIGIN_PREFIXES = [
  "chrome-extension://",
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
