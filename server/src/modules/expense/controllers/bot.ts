import type { Bot } from "grammy";

import { ingestExpenseReqSchema, ingestExpenseRespSchema } from "./zod-schema";
import type { IngestExpenseResp } from "./zod-schema";
import type { ExpenseUseCase } from "@/modules/expense/use-case";
import { LinkedAccountError } from "@/modules/linked-account/error";
import type { Logger } from "@/pkg/logger";

export function registerExpenseCommands({
  bot,
  logger,
  expenseUseCase,
}: {
  bot: Bot;
  logger: Logger;
  expenseUseCase: ExpenseUseCase;
}) {
  bot.command("expense", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Cannot identify your Telegram account.");
      return;
    }
    if (!ctx.match) {
      await ctx.reply("Usage: /expense <description>\nExample: /expense bakso 15k kemarin");
      return;
    }

    let result: IngestExpenseResp;
    try {
      const request = ingestExpenseReqSchema.parse({
        platform: "telegram",
        platformUserId: ctx.from.id.toString(),
        rawText: ctx.msg.text,
        parsingInput: ctx.match,
        externalConversationId: ctx.chat.id.toString(),
        externalMessageId: ctx.msg.message_id.toString(),
        idempotencyKey: `telegram:expense:${ctx.chat.id}:${ctx.msg.message_id}`,
      });
      result = await expenseUseCase.ingestExpense(request);
    } catch (error) {
      if (LinkedAccountError.isAccountNotFound(error)) {
        await ctx.reply(
          "Link your account first using /link <api-key> in a private chat with the bot."
        );
        return;
      }
      logger.error(
        {
          err: error,
          updateId: ctx.update.update_id,
          chatId: ctx.chat.id,
          messageId: ctx.msg.message_id,
        },
        "Failed to save expense"
      );
      await ctx.reply("❌ Failed to save expense. Please try again.");
      return;
    }

    // Saving has committed. A reply failure must not become a save-failure response.
    try {
      const { expense } = ingestExpenseRespSchema.parse(result);
      await ctx.reply(
        [
          "✅ Saved expense:",
          `Item: ${expense.itemName}`,
          `Amount: Rp ${Intl.NumberFormat("id-ID").format(BigInt(expense.amount))}`,
          `Date: ${expense.expenseDate}`,
          expense.categorySlug ? `Category: ${expense.categorySlug}` : null,
          expense.note ? `Note: ${expense.note}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      );
    } catch (error) {
      logger.error(
        { err: error, updateId: ctx.update.update_id, expenseId: result.expense.id },
        "Expense saved but confirmation failed"
      );
      throw error;
    }
  });
}
