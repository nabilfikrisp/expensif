export class LinkedAccountError extends Error {
  static readonly ERROR_NAME = "LinkedAccount Error";

  static accountAlreadyLinked() {
    return new LinkedAccountError("This account is already linked", 409, "ACCOUNT_ALREADY_LINKED");
  }

  static accountNotFound() {
    return new LinkedAccountError("Linked account not found", 404, "ACCOUNT_NOT_FOUND");
  }

  private constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = LinkedAccountError.ERROR_NAME;
  }
}
