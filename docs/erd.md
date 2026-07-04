# Expense Tracker — Table Reference

## USERS

Dashboard login identity.

| Column        | Type      | Notes                            |
| ------------- | --------- | -------------------------------- |
| id            | uuid      | PK                               |
| email         | string    | unique, used for dashboard login |
| password_hash | string    | bcrypt/argon2 hash               |
| name          | string    | display name                     |
| created_at    | timestamp |                                  |

## API_KEYS

One-time keys generated from the dashboard, used to link a bot account (any platform) to a user.

| Column       | Type      | Notes                          |
| ------------ | --------- | ------------------------------ |
| id           | uuid      | PK                             |
| user_id      | uuid      | FK → USERS                     |
| key_hash     | string    | store hashed, never plaintext  |
| label        | string    | optional, e.g. "telegram link" |
| created_at   | timestamp |                                |
| last_used_at | timestamp | nullable                       |
| revoked_at   | timestamp | nullable                       |

**Linking flow:** user generates a key in the dashboard → sends `/link <key>` to a bot
(Telegram, Discord, etc.) → bot verifies the key, creates a `LINKED_ACCOUNTS` row for
that platform, marks the key used. After linking, incoming messages are mapped to a
user via `LINKED_ACCOUNTS`, no key needed per message.

## LINKED_ACCOUNTS

One row per platform connection. Supports multiple bots (Telegram, Discord, ...) per user.

| Column            | Type      | Notes                                                                               |
| ----------------- | --------- | ----------------------------------------------------------------------------------- |
| id                | uuid      | PK                                                                                  |
| user_id           | uuid      | FK → USERS                                                                          |
| platform          | string    | `telegram` / `discord` / etc.                                                       |
| platform_user_id  | string    | platform's own account/chat id (generic string, works for numeric or snowflake ids) |
| platform_username | string    | nullable, for display only                                                          |
| linked_at         | timestamp |                                                                                     |

Unique constraint on `(platform, platform_user_id)` so the same platform account can't be linked to two users.

## CATEGORIES

Fixed, global, predefined list (not per-user). Seed one row as `"Uncategorized"`.

| Column | Type   | Notes                    |
| ------ | ------ | ------------------------ |
| id     | uuid   | PK                       |
| name   | string | e.g. "Food", "Transport" |
| slug   | string | e.g. "food"              |
| icon   | string | optional, for UI         |

## MESSAGES

Raw log of every incoming message, exactly as sent. Kept separate from `EXPENSES` because
one message can produce multiple expense line items, and it preserves an audit trail /
lets you re-run parsing later if the LLM prompt improves.

| Column              | Type      | Notes                                                            |
| ------------------- | --------- | ---------------------------------------------------------------- |
| id                  | uuid      | PK                                                               |
| user_id             | uuid      | FK → USERS                                                       |
| linked_account_id   | uuid      | FK → LINKED_ACCOUNTS, nullable if entered manually via dashboard |
| raw_text            | text      | exact original message                                           |
| external_message_id | string    | nullable, the platform's own message id                          |
| parse_status        | string    | `success` / `partial` / `failed`                                 |
| received_at         | timestamp |                                                                  |

## EXPENSES

Parsed line items. Many rows can point to the same `message_id` when a single message
contains multiple items (e.g. "beli baso 25k sama es teh 5k" → 2 rows).

| Column       | Type      | Notes                                                                     |
| ------------ | --------- | ------------------------------------------------------------------------- |
| id           | uuid      | PK                                                                        |
| message_id   | uuid      | FK → MESSAGES, nullable if entered manually via dashboard                 |
| user_id      | uuid      | FK → USERS, denormalized for simpler dashboard queries                    |
| category_id  | uuid      | FK → CATEGORIES, **nullable** — null/Uncategorized if LLM isn't confident |
| item_name    | string    | e.g. "Baso"                                                               |
| amount       | decimal   | e.g. 25000                                                                |
| currency     | string    | default `IDR`                                                             |
| expense_date | date      | date only, no time — resolved from relative terms like "hari ini"         |
| note         | string    | optional extra context                                                    |
| created_at   | timestamp |                                                                           |
| updated_at   | timestamp | edits overwrite in place, no history table                                |
