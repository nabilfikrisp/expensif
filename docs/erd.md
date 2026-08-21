# Expense Tracker — Table Reference

## USERS

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| email | string | unique, dashboard login |
| password_hash | string | bcrypt hash |
| name | string | display name |
| created_at | timestamp | `CURRENT_TIMESTAMP` |

## API_KEYS

One-time keys for linking bot accounts to users.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → USERS (cascade delete) |
| key_hash | string | HMAC-SHA256, never store plaintext |
| key_hint | string | `ek_****a1b2`, shown in dashboard |
| label | string | optional, e.g. "telegram link" |
| created_at | timestamp | `CURRENT_TIMESTAMP` |
| last_used_at | timestamp | nullable, set on first use |
| revoked_at | timestamp | nullable, set on revoke |

## LINKED_ACCOUNTS

One row per platform connection. Unique on `(platform, platform_user_id)`.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → USERS (cascade delete) |
| platform | string | `telegram` / `discord` / etc. |
| platform_user_id | string | platform's account id |
| platform_username | string | nullable, display only |
| linked_at | timestamp | `CURRENT_TIMESTAMP` |

## CATEGORIES

Fixed, global predefined list. Seed one row as `"Uncategorized"`.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | string | e.g. "Food", "Transport" |
| slug | string | e.g. "food" |

## MESSAGES

Raw log of every incoming message. One message can produce multiple expenses.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → USERS |
| linked_account_id | uuid | FK → LINKED_ACCOUNTS, nullable |
| raw_text | text | exact original message |
| external_message_id | string | nullable, unique per platform |
| parse_status | string | `success` / `partial` / `failed` |
| received_at | timestamp | `CURRENT_TIMESTAMP` |

## EXPENSES

Parsed line items. Multiple rows per message.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| message_id | uuid | FK → MESSAGES, nullable |
| user_id | uuid | FK → USERS (denormalized) |
| category_id | uuid | FK → CATEGORIES, nullable |
| item_name | string | e.g. "Baso" |
| amount | decimal | e.g. 25000 |
| currency | string | default `IDR` |
| expense_date | date | date only, no time |
| note | string | optional |
| created_at | timestamp | `CURRENT_TIMESTAMP` |
| updated_at | timestamp | `CURRENT_TIMESTAMP` |
