import cors from "cors";

/**
 * CORS policy:
 *  - `chrome-extension://` — extension background fetch
 *  - `https://app.manychat.com` — content-script fetch in page context
 *  - localhost — dev tabs and curl
 *  - No Origin — curl, server-to-server
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

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const ok =
      ALLOWED_ORIGIN_PREFIXES.some((p) => origin.startsWith(p)) ||
      FRONTEND_DEV_ORIGINS.includes(origin);
    if (ok) return callback(null, true);
    console.warn(`[cors] rejected origin: ${origin}`);
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
});
