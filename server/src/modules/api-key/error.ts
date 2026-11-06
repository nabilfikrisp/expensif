export class ApiKeyError extends Error {
  static readonly ERROR_NAME = "ApiKey Error";

  static keyNotFound() {
    return new ApiKeyError("API key not found", 404, "API_KEY_NOT_FOUND");
  }

  static keyAlreadyRevoked() {
    return new ApiKeyError("API key is already revoked", 400, "API_KEY_ALREADY_REVOKED");
  }

  static keyInvalid() {
    return new ApiKeyError("Invalid API key", 401, "API_KEY_INVALID");
  }

  private constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = ApiKeyError.ERROR_NAME;
  }
}
