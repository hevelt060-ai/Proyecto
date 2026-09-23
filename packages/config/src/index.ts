import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { z } from "zod";

if (existsSync(".env")) {
  loadEnvFile(".env");
}

const environmentSchema = z.enum(["development", "test", "staging", "production"]);

const configSchema = z.object({
  NODE_ENV: environmentSchema.default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_PREFIX: z
    .string()
    .regex(/^\/api\/v[0-9]+$/)
    .default("/api/v1"),
  USE_MONGODB: z.enum(["true", "false"]).default("false"),
  MONGODB_URI: z.string().min(1).optional(),
  MONGODB_DATABASE: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  PASSWORD_PEPPER: z.string().min(16).optional(),
  REDIS_URL: z.string().url().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
});

export interface AppConfig {
  environment: "development" | "test" | "staging" | "production";
  port: number;
  apiPrefix: string;
  mongoUri: string;
  mongoDatabase: string;
  sessionSecret?: string;
  passwordPepper?: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  useMongoDb: boolean;
}

export const loadConfig = (environment = process.env.NODE_ENV ?? "development"): AppConfig => {
  const parsed = configSchema.parse({ ...process.env, NODE_ENV: environment });
  if (parsed.USE_MONGODB === "true" && (!parsed.MONGODB_URI || !parsed.MONGODB_DATABASE)) {
    throw new Error("MONGODB_URI and MONGODB_DATABASE are required when USE_MONGODB=true");
  }

  if (parsed.NODE_ENV === "production" && !parsed.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be configured in production");
  }

  return {
    environment: parsed.NODE_ENV,
    port: parsed.PORT,
    apiPrefix: parsed.API_PREFIX,
    useMongoDb: parsed.USE_MONGODB === "true",
    mongoUri: parsed.MONGODB_URI ?? "",
    mongoDatabase: parsed.MONGODB_DATABASE ?? "",
    ...(parsed.SESSION_SECRET ? { sessionSecret: parsed.SESSION_SECRET } : {}),
    ...(parsed.PASSWORD_PEPPER ? { passwordPepper: parsed.PASSWORD_PEPPER } : {}),
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: parsed.RATE_LIMIT_MAX,
  };
};
