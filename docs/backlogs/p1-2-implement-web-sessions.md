# Implement web sessions

Problem: Existing refresh JWTs are not tracked server-side, so logout cannot revoke the current refresh session and refresh lifetimes differ from the web target.

Evidence: [Authentication status](../status.md#target-vs-actual) and [session design](../session-revocation.md).

Blocked by: [Resolve web session design details](p1-1-resolve-web-session-design.md) and explicit maintainer approval of the session migration.

Done when:

- The approved session migration and server behavior implement the decided session design, including revocation, expiry, cookie handling, and failure behavior.
- The static dashboard authentication flow and the agreed security and maintenance scope follow the session design.
- Tests cover session lifecycle, concurrency, failures, and the agreed browser flow; status and affected documentation reflect the result.
