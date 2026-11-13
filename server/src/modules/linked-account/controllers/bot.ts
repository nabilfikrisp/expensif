import type { Bot } from "grammy";

import { LinkedAccountError } from "@/modules/linked-account/error";
import type { LinkedAccountUseCase } from "@/modules/linked-account/use-case/interface";
import type { Logger } from "@/pkg/logger";

const wording = {
  link: {
    usage: "Usage: /link <api-key>\nGet your key from the dashboard.",
    success: (name: string, email: string) => `Linked to ${name} (${email})`,
    invalidKey: "Invalid, expired, or already-used key.",
    alreadyLinked: "This Telegram account is already linked.",
    failed: "Couldn't link right now. Please try again later.",
  },
} as const;

const PLATFORM_NAME = "telegram";

export function registerLinkCommand({
  bot,
  logger,
  linkedAccountUseCase,
}: {
  bot: Bot;
  logger: Logger;
  linkedAccountUseCase: LinkedAccountUseCase;
}) {
  bot.command("link", async (ctx) => {
    const token = ctx.match.trim();
    if (!token) {
      await ctx.reply(wording.link.usage);
      return;
    }

    const from = ctx.from;
    if (!from) {
      await ctx.reply("Cannot identify your Telegram account.");
      return;
    }
    const platformUserId = from.id.toString();

    let userName: string;
    let userEmail: string;
    try {
      ({ userName, userEmail } = await linkedAccountUseCase.redeemApiKey({
        token,
        platformUserId,
        platformUsername: from.username,
        platform: PLATFORM_NAME,
        idempotencyKey: `${PLATFORM_NAME}:link:${ctx.chat.id}:${ctx.msg.message_id}`,
      }));
    } catch (err) {
      if (err instanceof LinkedAccountError) {
        if (err.code === "LINK_KEY_INVALID") {
          await ctx.reply(wording.link.invalidKey);
          return;
        }
        if (err.code === "ACCOUNT_ALREADY_LINKED") {
          await ctx.reply(wording.link.alreadyLinked);
          return;
        }
      }
      logger.error({ err, platformUserId }, "Link command failed");
      await ctx.reply(wording.link.failed);
      return;
    }

    await ctx.reply(wording.link.success(userName, userEmail));
  });
}
