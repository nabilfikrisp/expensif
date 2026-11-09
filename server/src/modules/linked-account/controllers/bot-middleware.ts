import type { MiddlewareFn } from "grammy";

import { LinkedAccountError } from "@/modules/linked-account/error";
import type { LinkedAccountService } from "@/modules/linked-account/service";

export function initRequireLinkedAccountMiddleware(
  linkedAccountService: LinkedAccountService
): MiddlewareFn {
  return async (ctx, next) => {
    if (!ctx.from) {
      await ctx.reply("Cannot identify your Telegram account.");
      return;
    }

    try {
      await linkedAccountService.getUserByLinkedAccount("telegram", ctx.from.id.toString());
    } catch (error) {
      if (LinkedAccountError.isAccountNotFound(error)) {
        await ctx.reply(
          "Link your account first using /link <api-key> in a private chat with the bot."
        );
        return;
      }
      throw error;
    }

    await next();
  };
}
