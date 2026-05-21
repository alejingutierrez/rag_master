// Configuracion centralizada de AWS
// Soporta tanto AWS_* (local) como APP_* (Amplify, que no permite prefijo AWS_)

// BUG histórico: pasar `requestHandler: { requestTimeout, connectionTimeout }` como
// objeto plano hace que el cliente Bedrock se corrompa después del primer request
// (segundo request muere silenciosamente con exit 0). El SDK necesita un
// NodeHttpHandler instance, no un objeto plano.
// Para tiempos largos (Opus + contexto grande) en streaming usamos NodeHttpHandler
// abajo. Para cualquier otro caso, los defaults del SDK son seguros.
import { NodeHttpHandler } from "@smithy/node-http-handler";

export const awsConfig = {
  region: process.env.AWS_REGION || process.env.APP_AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId:
      process.env.AWS_ACCESS_KEY_ID || process.env.APP_ACCESS_KEY_ID || "",
    secretAccessKey:
      process.env.AWS_SECRET_ACCESS_KEY ||
      process.env.APP_SECRET_ACCESS_KEY ||
      "",
  },
  // Handler real (no objeto plano) — Opus con 80KB de contexto puede tardar 60-90s
  requestHandler: new NodeHttpHandler({
    requestTimeout: 180_000,    // 3 min timeout para la conexión HTTP
    connectionTimeout: 10_000,  // 10s para establecer conexión
  }),
};
