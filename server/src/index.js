import { app } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.PORT, () => {
  console.log(`[server] API escuchando en http://localhost:${env.PORT}`);
});

function shutdown(signal) {
  console.log(`[server] ${signal} recibido, cerrando...`);
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));