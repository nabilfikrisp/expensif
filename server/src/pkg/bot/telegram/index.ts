import { Bot } from "grammy";
import type { ExpensesService } from "@/modules/expense/service";

export function initBot(token: string, expenseService: ExpensesService) {
  // orders matters for command and message
  const bot = new Bot(token);

  bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

  bot.command("expense", async (ctx) => {
    const text = ctx.match;
    if (!text) {
      await ctx.reply("Usage: /expense <description>\nExample: /expense bakso 15k kemarin");
      return;
    }

    const sent = await ctx.reply("⏳ Processing...");

    try {
      const result = await expenseService.parseExpense(text);
      await ctx.api.editMessageText(
        ctx.chat.id,
        sent.message_id,
        [
          "✅ Parsed expense:",
          `Item: ${result.item_name}`,
          `Amount: ${result.amount} ${result.currency}`,
          `Date: ${result.date}`,
          `Category: ${result.category}`,
          result.note ? `Note: ${result.note}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      );
    } catch (error) {
      console.error("--- Raw parse error ---");
      console.error("Input:", text);
      console.error("Error:", error);
      await ctx.api.editMessageText(
        ctx.chat.id,
        sent.message_id,
        `❌ Failed to parse: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  });

  bot.on("message", (ctx) => ctx.reply("Got another message!"));

  return bot;
}

export function startBot(bot: Bot) {
  void bot.start();
  console.log("Telegram Bot is running...");
}
