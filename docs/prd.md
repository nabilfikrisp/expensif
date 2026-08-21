# Expense Tracker — PRD

## Overview

Multi-user expense tracking app. Users type natural-language messages (e.g. `"gua makan baso hari ini harganya 25k"`) into a bot (Telegram, Discord planned). An LLM parses each message into structured expense entries. Users view/edit via web dashboard.

## Design Decisions

- **Multi-user** — each linkable to multiple bot platforms via `LINKED_ACCOUNTS`
- **Dashboard auth** — email/password. Bot accounts linked via API key (`/link <key>`)
- **Categories** — fixed predefined list; LLM maps items, falls back to `null`/"Uncategorized"
- **No confirmation** — bot saves immediately; corrections via bot or dashboard
- **Multi-item messages** — one message → multiple `EXPENSES` rows
- **No budgeting/reporting** — just log + view/list for now
- **No edit history** — edits overwrite in place

## Implementation Notes

- Pass current date/timezone into LLM prompt for relative date resolution
- `expense_date` stores date only (day/month grouping)
- `key_hash` for API keys (not plaintext)
- `platform_user_id` is generic string (works for numeric or snowflake ids)
