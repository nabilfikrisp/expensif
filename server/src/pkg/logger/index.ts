import pino from "pino";
import type { EnvSchema } from "@/pkg/env";

export type Logger = pino.Logger;

const LOG_LEVELS: Record<string, string> = {
  development: "debug",
  test: "silent",
  production: "info",
};

export function initLogger(
  env: Pick<EnvSchema, "NODE_ENV">,
  destination?: pino.DestinationStream
): Logger {
  const options = { level: LOG_LEVELS[env.NODE_ENV] };
  return destination ? pino(options, destination) : pino(options);
}
