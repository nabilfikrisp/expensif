import { Hono } from "hono";
import { initExpenseService } from "@/modules/expense/service";
import { initBot, startBot } from "@/pkg/bot/telegram";
import { initDb } from "@/pkg/db";
import type { Db } from "@/pkg/db";
import { initEnv } from "@/pkg/env";
import type { EnvSchema } from "@/pkg/env";
import { startHttp } from "@/pkg/http";
import { initLlm } from "@/pkg/llm";

function initApp(env: EnvSchema, db: Db) {
  const app = new Hono();
  app.get("/", (c) => c.text(`Hello Hono is running in port: ${env.PORT}!`));
  return app;
}

const env = initEnv();
const db = initDb(env.DATABASE_URL);
const app = initApp(env, db);
const llm = initLlm(env.OPENROUTER_API_KEY, env.OPENROUTER_MODEL);
const expenseService = initExpenseService(llm, db);
const bot = initBot(env.TELEGRAM_BOT_TOKEN, expenseService);

startHttp(app, env.PORT);
startBot(bot);
