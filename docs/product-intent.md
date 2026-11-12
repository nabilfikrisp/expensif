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
- Expense commands resolve the linked owner, produce one expense record initially, and save immediately without a confirmation step. Multiple expense records per message remain future scope; an expense may include [several items sharing one total](data-model.md#expenses).
- Each user views and corrects their own expenses. Edits overwrite existing values.
- Fixed global categories classify expenses. Unmatched items use the [chosen fallback category](#why-a-particular-fallback-category).
- An expense date is separate from creation and update timestamps, supporting day/month grouping. Relative dates follow the [timezone policy](#why-a-particular-timezone-policy).
- Generic platform and platform-user identities support Telegram and future Discord integration.

## Initial scope

The initial target includes authentication, account linking, message and expense storage, expense APIs, a web dashboard, and bot corrections. The chosen logout behavior is recorded [below](#why-a-particular-logout-scope); remaining authentication work is tracked in [authentication follow-up](auth-follow-up.md).

Budgeting, reporting, and edit history are outside the initial scope.

The [data model](data-model.md) describes the intended storage structure. Commands, API routes, and configuration stay in the [server README](../server/README.md).

## Product decisions

Decisions and remaining questions are not assigned work. Only the maintainer decides them; agents must not fill in reasons or choose policies.

### Why a particular currency policy

Decision: Support only whole-rupiah (`IDR`) amounts. Use Indonesian number conventions (`15.000` means fifteen thousand) and expand shorthand such as `15k` and `1.5jt`; reject fractional rupiah. Store normalized amounts and currency; preserve original messages. The frontend handles display formatting with `id-ID` and `IDR`.

Reason: The application is currently developed for my personal use, and my daily expenses are in rupiah. IDR-only support and whole-rupiah amounts meet my current needs.

### Why a particular timezone policy

Decision: Use the fixed application timezone `Asia/Jakarta` for now, rather than per-user timezone settings. Interpret relative expense dates in this timezone. Expense dates remain date-only values; stored timestamps still represent instants.

Reason: The application is currently developed for my personal use, so a fixed `Asia/Jakarta` timezone meets my current needs.

### Why Indonesian frontend wording

Decision: Write frontend wording in Indonesian, aligned with the currency and timezone policies above. Repository documentation remains in English.

Reason: Indonesian frontend wording keeps the interface consistent with the rupiah currency and Jakarta timezone choices.

### Why a particular fallback category

Decision: Use a category named `other` as the fallback. This supersedes the earlier “uncategorized” wording; implementation gaps remain in [status](status.md#target-vs-actual).

Reason: The fallback category is named `other`.

### Why a particular logout scope

Decision: Use short-lived access JWTs and server-tracked refresh sessions. Logout revokes only the current refresh session and clears cookies; other sessions remain active. Already-issued access JWTs remain usable until expiry, and ordinary API requests do not look up session state.

Reason: Logout should affect only the current device. I prefer to preserve stateless access-JWT validation rather than track access tokens in the database.

### Why a particular retention policy

Decision: Message and expense retention periods remain undecided.

Reason: I have not yet encountered a concrete retention problem. I will revisit this when the need becomes clear.
