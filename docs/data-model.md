---
status: target
updated: 2026-11-06
---

# Data model

> TARGET. Describes what is intended, not what runs. Actual behavior: [status.md](status.md) and the code.

This document describes the intended storage model and its unresolved constraints.

The model carries forward the previous ERD as a target baseline. It does not establish implemented behavior. Actual definitions live in the [domain schemas](../server/src/modules/) and [committed migrations](../server/src/pkg/db/migrations/); known differences and undecided constraint policies are recorded only in [status](status.md#target-vs-actual).

IDs and foreign-key IDs use PostgreSQL `text`; application-created user, API-key, and linked-account IDs use UUID strings. Timestamps use `timestamp with time zone`, represented as strings in Drizzle. Columns are required unless marked nullable. Creation timestamps default to `now()`.

## users

| Column        | Type        | Notes           |
| ------------- | ----------- | --------------- |
| id            | text        | Primary key     |
| email         | text        | Unique          |
| password_hash | text        | bcrypt hash     |
| name          | text        | Display name    |
| created_at    | timestamptz | Default `now()` |

## api_keys

Short-lived, single-use account-linking keys, rather than general API bearer credentials.

| Column       | Type        | Notes                           |
| ------------ | ----------- | ------------------------------- |
| id           | text        | Primary key                     |
| user_id      | text        | FK to users; cascade delete     |
| key_hash     | text        | HMAC-SHA256 hash; indexed       |
| key_hint     | text        | Masked display hint             |
| label        | text        | Nullable                        |
| created_at   | timestamptz | Default `now()`                 |
| expires_at   | timestamptz | Expiry set at issuance          |
| last_used_at | timestamptz | Nullable; consumption timestamp |
| revoked_at   | timestamptz | Nullable; revocation timestamp  |

## linked_accounts

Unique on `(platform, platform_user_id)`; indexed on `user_id`. Platform usernames are display information, not identities.

| Column            | Type        | Notes                       |
| ----------------- | ----------- | --------------------------- |
| id                | text        | Primary key                 |
| user_id           | text        | FK to users; cascade delete |
| platform          | text        | Platform identifier         |
| platform_user_id  | text        | Platform account ID         |
| platform_username | text        | Nullable                    |
| linked_at         | timestamptz | Default `now()`             |

## categories

Global categories classify expenses.

| Column | Type | Notes        |
| ------ | ---- | ------------ |
| id     | text | Primary key  |
| name   | text | Display name |
| slug   | text | Unique       |

## messages

Raw messages may produce multiple expenses. Indexes cover `user_id` and `linked_account_id`.

| Column              | Type        | Notes                                                                           |
| ------------------- | ----------- | ------------------------------------------------------------------------------- |
| id                  | text        | Primary key                                                                     |
| user_id             | text        | FK to users; cascade delete                                                     |
| linked_account_id   | text        | Nullable FK to linked_accounts; set null on delete                              |
| raw_text            | text        | Original message text                                                           |
| external_message_id | text        | Nullable; uniqueness scope remains open in [status](status.md#target-vs-actual) |
| parse_status        | text        | Parsing state; allowed values remain undefined                                  |
| received_at         | timestamptz | Default `now()`                                                                 |

## expenses

Multiple expenses can belong to one message. Indexes cover `(user_id, expense_date)`, `message_id`, and `category_id`.

| Column       | Type          | Notes                                                                                            |
| ------------ | ------------- | ------------------------------------------------------------------------------------------------ |
| id           | text          | Primary key                                                                                      |
| message_id   | text          | Nullable FK to messages; set null on delete                                                      |
| user_id      | text          | FK to users; cascade delete                                                                      |
| category_id  | text          | Nullable FK to categories; set null on delete                                                    |
| item_name    | text          | Item description                                                                                 |
| amount       | numeric(20,2) | Exact decimal string in Drizzle; 18 integer and 2 fractional digits                              |
| currency     | text          | Default `IDR`; follows the [currency policy](product-intent.md#why-a-particular-currency-policy) |
| expense_date | date          | Date-only string, separate from timestamps                                                       |
| note         | text          | Nullable                                                                                         |
| created_at   | timestamptz   | Default `now()`                                                                                  |
| updated_at   | timestamptz   | Default `now()` on insert; update maintenance must be defined when edits are implemented         |

Retention policy is [open](product-intent.md#why-a-particular-retention-policy). This model does not add revocation columns or a session table: [session revocation](session-revocation.md) is still a proposal. Schema changes follow the [migration rules](../AGENTS.md#hard-rules).
