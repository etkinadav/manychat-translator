import path from "path";
import dotenv from "dotenv";
import app from "./app";
import { connectMongo } from "./db/mongoose";
import { ensureProjectIdResolved } from "./services/googleTranslate.service";

// Load `.env` from backend/ (same pattern as beams app.js)
dotenv.config();
dotenv.config({ path: path.join(__dirname, "..", ".env"), override: true });

const PORT = Number(process.env.PORT ?? 3000);

async function startServer(): Promise<void> {
  try {
    await connectMongo();
  } catch (err) {
    console.error("[server] MongoDB connection failed:", err);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`[server] backend started on http://localhost:${PORT}`);
    console.log(
      "[server] routes: POST /api/translate, POST /api/user/login, GET /api/user/profile",
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
