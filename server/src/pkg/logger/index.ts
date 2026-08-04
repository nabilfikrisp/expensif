import pino from "pino";
import type { Logger as PinoLogger } from "pino";
import type { EnvSchema } from "@/pkg/env";

export type Logger = PinoLogger;

export function initLogger(env: EnvSchema): Logger {
  return pino({
    level: env.NODE_ENV === "development" ? "debug" : "info",
  });
}
