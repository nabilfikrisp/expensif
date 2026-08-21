export class AuthError extends Error {
  static readonly ERROR_NAME = "Auth Error";

  static emailAlreadyRegistered() {
    return new AuthError(
      "An account with this email already exists",
      409,
      "EMAIL_ALREADY_REGISTERED"
    );
  }
  static invalidCredentials() {
    return new AuthError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }
  static userNotFound() {
    return new AuthError("No account found with this email", 404, "USER_NOT_FOUND");
  }
  static invalidToken() {
    return new AuthError("Invalid or expired token. Please log in again", 401, "INVALID_TOKEN");
  }
  static missingBearerHeader() {
    return new AuthError("Authentication required", 401, "MISSING_BEARER_HEADER");
  }
  static invalidJwtPayload() {
    return new AuthError("Invalid authentication token", 401, "INVALID_JWT_PAYLOAD");
  }
  static failedVerifyingJwt() {
    return new AuthError("Authentication failed", 401, "FAILED_VERIFYING_JWT");
  }
  static invalidCsrfToken() {
    return new AuthError("Invalid CSRF token", 403, "INVALID_CSRF_TOKEN");
  }

  private constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = AuthError.ERROR_NAME;
  }
}
