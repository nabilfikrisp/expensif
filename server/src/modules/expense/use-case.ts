import { ExpenseError } from "./error";
import type { ExpensesService } from "./service";
import { ingestExpenseInputSchema, ingestExpenseOutputSchema } from "./use-case-schema";
import type { IngestExpenseInput, IngestExpenseOutput } from "./use-case-schema";
import type { LinkedAccountService } from "@/modules/linked-account/service";
import { MessageError } from "@/modules/message/error";
import type { MessageService } from "@/modules/message/service";
import type { Db, Tx } from "@/pkg/db";

export interface InitExpenseUseCase {
  db: Db;
  linkedAccountService: LinkedAccountService;
  messageService: MessageService;
  expenseService: ExpensesService;
}

export function initExpenseUseCase({
  db,
  linkedAccountService,
  messageService,
  expenseService,
}: InitExpenseUseCase) {
  // Finds the linked account for this request and checks whether its idempotency key
  // was already processed. `completed` is the saved result, or undefined for a new key.
  // Pass `expectedUserId` to make sure the account still belongs to the user we authorized earlier.
  async function loadOwnedRequest(input: IngestExpenseInput, tx: Tx, expectedUserId?: string) {
    const account = await linkedAccountService.getLinkedAccountForIngestion(
      input.platform,
      input.platformUserId,
      tx
    );
    if (expectedUserId !== undefined && account.userId !== expectedUserId) {
      throw ExpenseError.idempotencyConflict();
    }

    const message = await messageService.findMessageByIdempotencyKey(input.idempotencyKey, tx);
    if (!message) {
      return { account, completed: undefined };
    }

    // Knowing a key doesn't give access to someone else's expense, so check the owner.
    // We compare userId, not linkedAccountId, because unlinking clears linkedAccountId
    // on old messages.
    if (message.userId !== account.userId || message.platform !== input.platform) {
      throw ExpenseError.idempotencyConflict();
    }

    // Message and expense are saved together, so one without the other shouldn't happen.
    // Fail loudly instead of returning a half-finished result.
    const expense = await expenseService.findExpenseByMessageId(account.userId, message.id, tx);
    if (message.parseStatus !== "parsed" || !expense) {
      throw ExpenseError.savedResultIncomplete();
    }

    const completed = ingestExpenseOutputSchema.parse({
      messageId: message.id,
      parseStatus: message.parseStatus,
      expense,
    });
    return { account, completed };
  }

  return {
    // Same key, same result: a retry returns the saved expense instead of creating a new one.
    // Flow: check -> parse with the LLM -> save -> if we lost a race, return the winner's result.
    async ingestExpense(input: IngestExpenseInput): Promise<IngestExpenseOutput> {
      const request = ingestExpenseInputSchema.parse(input);

      // Fast path: if this key was already handled, return it and skip the LLM entirely.
      // Repeatable read so account, message and expense are read from one snapshot.
      // The account service also holds a shared lock until this transaction ends, so the
      // account can't be unlinked or relinked while we check ownership.
      const initial = await db.transaction((tx) => loadOwnedRequest(request, tx), {
        isolationLevel: "repeatable read",
      });
      if (initial.completed) {
        return initial.completed;
      }

      // The LLM call is slow, so it stays outside any transaction (no locks or connection
      // held while we wait). The price is that what we read above may be stale by the time
      // it returns, so we check again before writing.
      const parsedExpense = await expenseService.parseExpense({ text: request.parsingInput });

      try {
        return await db.transaction(async (tx) => {
          // Check again: while the LLM ran, the account could have been relinked
          // or a duplicate request could have finished.
          const current = await loadOwnedRequest(request, tx, initial.account.userId);
          if (current.completed) {
            return current.completed;
          }

          // The unique idempotency key is what really stops duplicates.
          // If another request got here first, this throws MessageError.
          const message = await messageService.createMessage(
            {
              userId: current.account.userId,
              linkedAccountId: current.account.id,
              platform: request.platform,
              rawText: request.rawText,
              externalConversationId: request.externalConversationId,
              externalMessageId: request.externalMessageId,
              idempotencyKey: request.idempotencyKey,
              parseStatus: "parsed",
            },
            tx
          );
          const expense = await expenseService.createExpense(
            {
              ...parsedExpense,
              userId: current.account.userId,
              messageId: message.id,
            },
            tx
          );

          return ingestExpenseOutputSchema.parse({
            messageId: message.id,
            parseStatus: message.parseStatus,
            expense: { ...expense, categorySlug: parsedExpense.categorySlug },
          });
        });
      } catch (error) {
        if (!(error instanceof MessageError)) {
          throw error;
        }

        // We lost the race to a duplicate request. The failed insert aborted our transaction
        // in PostgreSQL, so read the winner's result in a fresh one, and check ownership
        // again against the current link.
        const winner = await db.transaction(
          (tx) => loadOwnedRequest(request, tx, initial.account.userId),
          {
            isolationLevel: "repeatable read",
          }
        );
        if (!winner.completed) {
          throw error;
        }
        return winner.completed;
      }
    },
  };
}

export type ExpenseUseCase = ReturnType<typeof initExpenseUseCase>;
