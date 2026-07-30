import { initAuthRoutes } from "@/modules/auth/controllers/http";
import { initAuthService } from "@/modules/auth/service";
import { initExpenseService } from "@/modules/expense/service";
import { initBot, startBot } from "@/pkg/bot/telegram";
import { initDb } from "@/pkg/db";
import { initEnv } from "@/pkg/env";
import { initHttp, startHttp } from "@/pkg/http";
import { initLlm } from "@/pkg/llm";

const env = initEnv();
const db = initDb(env.DATABASE_URL);
const llm = initLlm(env.OPENROUTER_API_KEY, env.OPENROUTER_MODEL);
const expenseService = initExpenseService(llm, db);
const authService = initAuthService(env, db);
const authRoutes = initAuthRoutes(env, authService);

const app = initHttp(env, authRoutes);
const bot = initBot(env.TELEGRAM_BOT_TOKEN, expenseService);

startHttp(app, env.PORT);
startBot(bot);
