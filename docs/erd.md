# PostgreSQL table reference

Source of truth: `server/src/modules/*/schema.ts` and committed migrations under `server/src/pkg/db/migrations/`. The tables below describe the current schema, including tables not yet used by runtime expense persistence.

All IDs and foreign-key IDs are PostgreSQL `text`; application-created user, API-key, and linked-account IDs use UUID strings. All timestamp columns are `timestamp with time zone`, returned as strings by Drizzle. Columns are required unless marked nullable. Timestamp creation defaults use `now()`.

## users

| Column        | Type        | Notes           |
| ------------- | ----------- | --------------- |
| id            | text        | Primary key     |
| email         | text        | Unique          |
| password_hash | text        | bcrypt hash     |
| name          | text        | Display name    |
| created_at    | timestamptz | Default `now()` |

## api_keys

Single-use account-linking keys, not general API bearer credentials.

| Column       | Type        | Notes                                              |
| ------------ | ----------- | -------------------------------------------------- |
| id           | text        | Primary key                                        |
| user_id      | text        | FK to users; cascade delete                        |
| key_hash     | text        | HMAC-SHA256 hash; indexed, not a unique constraint |
| key_hint     | text        | Example: `ek_****a1b2`                             |
| label        | text        | Nullable                                           |
| created_at   | timestamptz | Default `now()`                                    |
| expires_at   | timestamptz | Required; service sets expiry at issuance          |
| last_used_at | timestamptz | Nullable; set when consumed or burned              |
| revoked_at   | timestamptz | Nullable                                           |

## linked_accounts

Unique on `(platform, platform_user_id)`; indexed on `user_id`.

| Column            | Type        | Notes                                     |
| ----------------- | ----------- | ----------------------------------------- |
| id                | text        | Primary key                               |
| user_id           | text        | FK to users; cascade delete               |
| platform          | text        | Telegram is implemented; no database enum |
| platform_user_id  | text        | Platform account ID                       |
| platform_username | text        | Nullable, display only                    |
| linked_at         | timestamptz | Default `now()`                           |

## categories

Schema only: no seed workflow currently populates this table. The expense parser uses a hardcoded category list.

| Column | Type | Notes                 |
| ------ | ---- | --------------------- |
| id     | text | Primary key           |
| name   | text | Category display name |
| slug   | text | Unique                |

## messages

Schema for raw messages; runtime message writes are not implemented. Indexed on `user_id` and `linked_account_id`.

| Column              | Type        | Notes                                                     |
| ------------------- | ----------- | --------------------------------------------------------- |
| id                  | text        | Primary key                                               |
| user_id             | text        | FK to users; cascade delete                               |
| linked_account_id   | text        | Nullable FK to linked_accounts; set null on delete        |
| raw_text            | text        | Original message text                                     |
| external_message_id | text        | Nullable; globally unique, not scoped by platform or chat |
| parse_status        | text        | Free text; no CHECK constraint or enum                    |
| received_at         | timestamptz | Default `now()`                                           |

Before implementing message ingestion, define how platform/chat-scoped message IDs map to the globally unique `external_message_id`.

## expenses

Schema supports multiple expenses per message; the current parser returns one object and does not insert it. Indexes cover `(user_id, expense_date)`, `message_id`, and `category_id`.

| Column       | Type          | Notes                                                               |
| ------------ | ------------- | ------------------------------------------------------------------- |
| id           | text          | Primary key                                                         |
| message_id   | text          | Nullable FK to messages; set null on delete                         |
| user_id      | text          | FK to users; cascade delete                                         |
| category_id  | text          | Nullable FK to categories; set null on delete                       |
| item_name    | text          | Item description                                                    |
| amount       | numeric(20,2) | Exact decimal string in Drizzle; 18 integer and 2 fractional digits |
| currency     | text          | Default `IDR`; no currency CHECK constraint                         |
| expense_date | date          | Date-only string                                                    |
| note         | text          | Nullable                                                            |
| created_at   | timestamptz   | Default `now()`                                                     |
| updated_at   | timestamptz   | Default `now()` on insert; no automatic update trigger              |

PostgreSQL rounds excess fractional precision in `amount`; the schema does not enforce a positive amount. Parser validation requires a positive number, but future persistence must also validate its inputs.
