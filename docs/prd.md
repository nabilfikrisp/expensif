# Expense Tracker — PRD

## Overview

A multi-user expense tracking app. Users type natural-language expense messages
(e.g. `"gua makan baso hari ini harganya 25k"`) into a bot (Telegram, with Discord
planned). An LLM parses each message into one or more structured expense entries.
Users log into a web dashboard (email/password) to view, edit, and manage their
expenses.

## Design Decisions

- **Multi-user**, each linkable to multiple bot platforms via `LINKED_ACCOUNTS`
  (built to support Telegram now, Discord and others later without schema changes).
- **Dashboard auth**: email/password. Bot accounts are linked via a generated API
  key (`/link <key>`), not used as the primary login.
- **Categories**: fixed predefined list; LLM maps parsed items to the closest match,
  falling back to `null`/"Uncategorized" when unsure.
- **No confirmation step**: bot saves immediately; corrections happen later via bot
  or dashboard edit.
- **Multi-item messages supported**: one message can fan out into multiple
  `EXPENSES` rows.
- **No budgeting/reporting for now** — just log + view/list. Can add later (e.g. a
  `BUDGETS` table keyed on `user_id` + `category_id` + `month`).
- **No edit history** — edits/deletes overwrite the `EXPENSES` row in place.

## Implementation Notes

- Pass current date/timezone into the LLM prompt so relative dates ("hari ini",
  "kemarin") resolve correctly.
- `expense_date` stores date only, since reporting groups by day/month.
- Store `key_hash` (not plaintext) for `API_KEYS`, same as `password_hash`.
- `platform_user_id` in `LINKED_ACCOUNTS` is a generic string to fit any platform's
  id format.
