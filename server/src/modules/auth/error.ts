export class AuthError extends Error {
  static emailAlreadyRegistered() {
    return new AuthError("Email already registered", 409);
  }
  static invalidCredentials() {
    return new AuthError("Invalid email or password", 401);
  }
  static userNotFound() {
    return new AuthError("User not found", 404);
  }
  static invalidToken() {
    return new AuthError("Invalid or expired token", 401);
  }

  private constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}
