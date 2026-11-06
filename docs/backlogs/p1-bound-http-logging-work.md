# Bound HTTP logging work

Problem: HTTP logging reads complete request bodies before rate limiting, logs valid JSON without a size bound, and buffers complete responses. Logging can consume excessive memory and CPU even for rejected requests and delay streaming responses.

Evidence: The [HTTP logger](../../server/src/pkg/http/logger-middleware.ts) reads bodies with `text()` and only truncates non-JSON or invalid JSON. [HTTP middleware registration](../../server/src/pkg/http/index.ts) places the logger before the default limiter.

Done when:

- Request size limits apply before any component buffers a request body, and rate-limited requests do not require body capture.
- Routine logging uses request/response metadata; any retained body logging is explicitly enabled, bounded during capture, and redacted.
- Logging does not consume complete streaming responses or delay their delivery until completion.
- Regression coverage exercises oversized valid JSON, rate-limited requests, streaming responses, and secret redaction.

Scope: Preserve contextual error logging. No product behavior or new logging infrastructure is required.
