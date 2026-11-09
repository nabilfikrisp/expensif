# Resolve web session design details

Problem: The web session design has open deployment, security, concurrency, and scope decisions needed before implementation.

Evidence: [Session design details](../session-revocation.md#details-still-to-define).

Done when:

- The maintainer decides the dashboard and API deployment relationship, CSRF bootstrap, and handling of cross-site cookie restrictions.
- The maintainer resolves expiry checks after lock waits and refresh responses arriving after logout, including across tabs.
- The maintainer decides current-session identification for password changes and the scope of password reset and change, sensitive-action reauthentication, rate limiting, and cleanup.
- Decisions are recorded in the existing session design. The proposed session migration is reviewed separately and approved before its implementation or execution.

Order: Complete this item before [implementing web sessions](p1-2-implement-web-sessions.md).
