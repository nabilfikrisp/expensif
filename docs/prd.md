# Expense Tracker — ERD & Schema Design

## Overview

A multi-user expense tracking app. Users type natural-language expense messages
(e.g. `"gua makan baso hari ini harganya 25k"`) into a Telegram bot. An LLM parses
the message into one or more structured expense entries. Users log into a web
dashboard (email/password) to view, edit, and manage their expenses.

## Design Decisions

- **Multi-user**, each with their own linked Telegram account.
- **Dashboard auth**: email/password. Telegram is linked via a generated API key, not
  used as the primary login mechanism.
- **Categories**: fixed predefined list; LLM maps parsed items to the closest existing
  category, falling back to null/"Uncategorized" when unsure.
- **No confirmation step**: bot saves immediately; corrections happen later via bot or
  dashboard edit.
- **Multi-item messages supported**: one `MESSAGES` row can fan out into multiple
  `EXPENSES` rows.
- **No budgeting/reporting tables for now** — just log + view/list. Can be added later
  (e.g. a `BUDGETS` table keyed on `user_id` + `category_id` + `month`).
- **No edit history** — edits/deletes overwrite the `EXPENSES` row in place.

## Notes for Implementation

- Pass the current date/timezone into the LLM parsing prompt so relative dates
  ("hari ini", "kemarin") resolve correctly.
- `expense_date` stores date only (no time) since reporting will group by day/month.
- Store `key_hash` (not plaintext) for `API_KEYS`, same as `password_hash`.
