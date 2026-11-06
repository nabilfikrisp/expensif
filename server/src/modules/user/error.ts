export class UserError extends Error {
  static readonly ERROR_NAME = "User Error";

  static notFound() {
    return new UserError("User not found", 404, "USER_NOT_FOUND");
  }

  private constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = UserError.ERROR_NAME;
  }
}
