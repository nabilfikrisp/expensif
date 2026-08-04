import type { Bot } from "grammy";
import type { ExpensesService } from "@/modules/expense/service";
import type { Logger } from "@/pkg/logger";

export function registerExpenseCommands(bot: Bot, logger: Logger, expenseService: ExpensesService) {
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
          `Amount: Rp ${Intl.NumberFormat("id-ID").format(result.amount)}`,
          `Date: ${result.date}`,
          `Category: ${result.category}`,
          result.note ? `Note: ${result.note}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      );
    } catch (error) {
      logger.error({ input: text, err: error }, "Failed to parse expense");
      await ctx.api.editMessageText(
        ctx.chat.id,
        sent.message_id,
        `❌ Failed to parse: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  });
}
