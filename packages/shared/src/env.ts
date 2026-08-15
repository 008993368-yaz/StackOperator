import { z } from "zod";

const optionalString = z.string().optional().default("");

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional().default("development"),
  DATABASE_URL: z
    .string()
    .min(1)
    .optional()
    .default("postgresql://stackoperator:stackoperator@localhost:5432/stackoperator"),
  GITHUB_APP_ID: optionalString,
  GITHUB_APP_SLUG: optionalString,
  GITHUB_APP_PRIVATE_KEY: optionalString,
  GITHUB_WEBHOOK_SECRET: optionalString,
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
  APP_BASE_URL: z.string().optional().default("http://localhost:3000"),
  SESSION_SECRET: z.string().optional().default("change-me-to-a-long-random-string"),
  DASHBOARD_OPEN_ACCESS: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((value) => value === "true"),
  LOG_LEVEL: z.string().optional().default("info"),
  LINUX_2CORE_USD_PER_MINUTE: z.coerce.number().optional().default(0.006),
  DEFAULT_ESTIMATED_MINUTES: z.coerce.number().optional().default(15),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) {
    return cached;
  }
  cached = envSchema.parse(source);
  return cached;
}

export function resetEnvCache(): void {
  cached = undefined;
}
