export class ExpenseError extends Error {
  static idempotencyConflict() {
    return new ExpenseError(
      "This request cannot be replayed by the linked account",
      409,
      "EXPENSE_IDEMPOTENCY_CONFLICT"
    );
  }

  static savedResultIncomplete() {
    return new ExpenseError(
      "The saved expense result is incomplete",
      500,
      "EXPENSE_SAVED_RESULT_INCOMPLETE"
    );
  }

  private constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = "Expense Error";
  }
}
