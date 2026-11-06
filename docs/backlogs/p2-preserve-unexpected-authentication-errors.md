# Preserve unexpected authentication errors

Problem: Authentication converts every token-verification failure into an invalid-credential response. Unexpected implementation or infrastructure failures lose their original context and appear as client errors.

Evidence: The [authentication middleware](../../server/src/modules/auth/controllers/middleware.ts) catches all verifier failures and includes downstream execution in the same try block. [Refresh verification](../../server/src/modules/auth/service.ts) also catches every verification error.

Done when:

- Only recognized token-validation failures become authentication errors; unknown errors propagate with their original context to the process boundary.
- Downstream middleware and controller execution sit outside the token-verification catch.
- Regression coverage distinguishes malformed or expired tokens, invalid payloads, unexpected verifier errors, and downstream failures.
- Unexpected errors produce the existing internal-error response and contextual error logging rather than a 401 response.

Scope: Preserve authentication behavior for handled failures. Session tracking, revocation, and token-lifetime changes are excluded.
