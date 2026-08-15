import { loadEnv, type Env } from "@stackoperator/shared";

export function webEnv(): Env {
  return loadEnv();
}
