export class MessageError extends Error {
  static idempotencyConflict(cause: unknown) {
    return new MessageError(cause);
  }

  readonly code = "MESSAGE_IDEMPOTENCY_CONFLICT";
  readonly statusCode = 409;

  private constructor(cause: unknown) {
    super("A message with this idempotency key already exists", { cause });
    this.name = "Message Error";
  }
}
