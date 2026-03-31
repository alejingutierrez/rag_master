// Configuracion centralizada de AWS
// Soporta tanto AWS_* (local) como APP_* (Amplify, que no permite prefijo AWS_)

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
  // Timeout largo para Opus con contexto grande (80KB → puede tomar 60-90s)
  requestHandler: {
    requestTimeout: 180_000,    // 3 min timeout para la conexión HTTP
    connectionTimeout: 10_000,  // 10s para establecer conexión
  },
};
