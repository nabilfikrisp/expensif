# Persist messages and expenses

Problem: Expense commands parse input but do not save messages or expenses. Duplicate delivery has no application-level persistence handling, and the existing message uniqueness rule assumes every platform identifies a source through platform, chat, and message IDs.

Evidence: The [expense service](../../server/src/modules/expense/service.ts) only parses; the [bot controller](../../server/src/modules/expense/controllers/bot.ts) displays the parsed result. The [message schema](../../server/src/modules/message/schema.ts) enforces composite source uniqueness. [Expense](../../server/src/modules/expense/schema.ts) and [category](../../server/src/modules/category/schema.ts) tables exist without runtime ingestion or category setup.

Done when:

- A linked user's command atomically saves its original message and one owned expense, or returns the existing owned result on retry, including concurrent delivery.
- Parsing and persistence failures leave neither record saved. Telegram confirmation follows commit and can be retried without duplicate writes.
- Database categories, exact whole-rupiah storage, Jakarta dates, ownership, and the [expense definition](../data-model.md#expenses) are enforced and covered through practical application entry points.
- The [implementation checklist](../todos/persist-messages-and-expenses.md) is complete and affected documentation reflects verified behavior.

Scope: Documentation and implementation planning do not authorize migration execution. One expense record per message is in scope; multiple records, edited-message handling, failed-message retention, and exactly-once Telegram replies are deferred. No generic idempotency framework or separate receipt table is required.
