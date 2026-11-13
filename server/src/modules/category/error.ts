export class CategoryError extends Error {
  static setupRequired() {
    return new CategoryError(
      'Required category "other" is missing. Run pnpm --dir server db:seed:categories.',
      500,
      "CATEGORY_SETUP_REQUIRED"
    );
  }

  private constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = "Category Error";
  }
}
