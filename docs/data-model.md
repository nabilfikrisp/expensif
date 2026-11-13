---
status: target
updated: 2026-11-06
---

# Data model

> TARGET. Describes what is intended, not what runs. Actual behavior: [status.md](status.md) and the code.

This document records intended data relationships, constraints, and unresolved storage decisions.

Column definitions live in the [domain schemas](../server/src/modules/); database changes live in [migrations](../server/src/pkg/db/migrations/).

## users

Users own their API keys, linked accounts, messages, and expenses. Deleting a user deletes that owned data.

## api_keys

Short-lived, single-use account-linking credentials, distinct from API access tokens. Revoking or deleting a key does not unlink an existing account.

## linked_accounts

An external account is identified by platform and platform user ID; usernames are display information. Repeated delivery of a successful linking command returns the existing link for that platform account, even after its key expires or is revoked. New commands still require an unused key. Unlinking removes the command's replay result and preserves historical messages and their external source identity.

## categories

Categories are global. The fallback follows the [product decision](product-intent.md#why-a-particular-fallback-category). Deleting a category preserves its expenses.

## messages

Preserve the original message text. Initial ingestion saves one expense per message; multiple expenses remain future scope. Platform controllers supply an opaque idempotency key independently of source metadata and the linked-account reference. Duplicate deliveries must not create additional expenses, including after unlinking or relinking. Deleting a message preserves its expenses.

Initial ingestion retains only successfully parsed messages with `parseStatus: "parsed"`; failed parsing leaves nothing saved. Other parsing-state values remain undefined.

## expenses

Each expense belongs to a user and may reference a source message and category. Several items sharing one combined total count as one expense, with a combined item description; do not invent individual prices or split the total. Application validation and database constraints must enforce positive, finite, whole-rupiah amounts; reject fractional input without rounding. Currency and display conventions follow the [currency policy](product-intent.md#why-a-particular-currency-policy).

Expense dates are separate from creation/update timestamps. Relative dates follow the [timezone policy](product-intent.md#why-a-particular-timezone-policy). Update-timestamp maintenance remains to be defined when editing is implemented.

Retention remains [open](product-intent.md#why-a-particular-retention-policy).
