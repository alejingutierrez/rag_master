import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  // Inline env vars at build time for Amplify SSR Lambda
  // (Amplify no pasa env vars al runtime de Lambda)
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    APP_AWS_REGION: process.env.APP_AWS_REGION,
    APP_ACCESS_KEY_ID: process.env.APP_ACCESS_KEY_ID,
    APP_SECRET_ACCESS_KEY: process.env.APP_SECRET_ACCESS_KEY,
    BEDROCK_CLAUDE_MODEL_ID: process.env.BEDROCK_CLAUDE_MODEL_ID,
    BEDROCK_EMBEDDING_MODEL_ID: process.env.BEDROCK_EMBEDDING_MODEL_ID,
  },
};

export default nextConfig;
