---
status: target
updated: 2026-11-06
---

# Product intent

> TARGET. Describes what is intended, not what runs. Actual behavior: [status.md](status.md) and the code.

This document defines the intended expense-tracking experience and its scope.

## Intended experience

Expensif is a multi-user expense tracker. Users send natural-language expense messages to a bot, then view and correct their expenses in a web dashboard or through the bot.

- Users register through the application and link a bot account using a short-lived, single-use API key. A linking key is not a general API bearer credential.
- Linking establishes account identity. Successful linking alone does not mean that expense storage is available; check [current capability status](status.md#capabilities).
- Expense commands resolve the linked owner, parse one or more items, and save immediately without a confirmation step.
- Each user views and corrects their own expenses. Edits overwrite existing values.
- Fixed global categories classify expenses. Unmatched items use the [chosen fallback category](#why-a-particular-fallback-category).
- An expense date is separate from creation and update timestamps, supporting day/month grouping. Relative dates use the user's timezone.
- Generic platform and platform-user identities support Telegram and future Discord integration.

## Initial scope

The target includes authentication, account linking, message and expense storage, expense APIs, a web dashboard, bot corrections, and multiple items per message. The chosen logout behavior is recorded [below](#why-a-particular-logout-scope); the unimplemented design remains a [separate proposal](session-revocation.md).

Budgeting, reporting, and edit history are outside the initial scope.

The [data model](data-model.md) describes the intended storage structure. Commands, API routes, and configuration stay in the [server README](../server/README.md).

## Product decisions

Decisions and remaining questions are not assigned work. Only the maintainer decides them; agents must not fill in reasons or choose policies.

### Why a particular currency policy

Decision: Support only Indonesian rupiah (`IDR`) for now. Amount-unit conventions remain undecided.

Reason: because currently its only for me, and my daily is in rupiah, so for now the system only support rupiah

### Why a particular timezone policy

Decision: The target uses the user's timezone; how it is chosen, stored, and handled when absent remains undecided.

Reason: the same reason as above

### Why a particular fallback category

Decision: Use a category named `other` as the fallback. This supersedes the earlier “uncategorized” wording; implementation gaps remain in [status](status.md#target-vs-actual).

Reason: the fallback will be category named other

### Why a particular logout scope

Decision: Use short-lived access JWTs and server-tracked refresh sessions. Logout revokes only the current refresh session and clears cookies; other sessions remain active. Already-issued access JWTs remain usable until expiry, and ordinary API requests do not look up session state.

Reason: the logout should only be for one device, and i think if we store jwt in db that mean we are fighting jwt convention

### Why a particular retention policy

Decision: Message and expense retention periods remain undecided.

Reason: i havent have the exact problem with this, will investigate later
