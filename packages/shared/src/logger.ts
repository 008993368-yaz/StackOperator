import pino, { type Logger } from "pino";

export type { Logger };

export type LogBindings = {
  installation_id?: string | number;
  repository_id?: string;
  stack_id?: string;
  pull_request_number?: number;
  workflow_run_id?: string | number;
  decision_id?: string;
};

export function createLogger(name: string): Logger {
  return pino({
    name,
    level: process.env["LOG_LEVEL"] ?? "info",
    redact: {
      paths: [
        "*.authorization",
        "*.private_key",
        "*.privateKey",
        "*.webhook_secret",
        "*.webhookSecret",
        "*.client_secret",
        "*.clientSecret",
        "*.session_secret",
        "*.sessionSecret",
        "*.token",
        "*.pem",
      ],
      censor: "[redacted]",
    },
    serializers: {
      err: pino.stdSerializers.err,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export function withContext(logger: Logger, bindings: LogBindings): Logger {
  const defined: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(bindings)) {
    if (value !== undefined) {
      defined[key] = value;
    }
  }
  return logger.child(defined);
}
