# Expense Tracker - Product requirements

## Goal

A multi-user expense tracker where users send natural-language messages such as "gua makan baso hari ini harganya 25k" to a bot, then view and edit expenses in a web dashboard.

## Implementation status

| Capability                              | Status                                                    |
| --------------------------------------- | --------------------------------------------------------- |
| Email/password auth and JWT refresh     | Implemented as HTTP APIs                                  |
| API-key management and Telegram linking | Implemented                                               |
| Natural-language expense parsing        | Prototype: `/expense` returns one parsed item             |
| Message and expense persistence         | Schema exists; runtime writes are not implemented         |
| Web dashboard and expense CRUD APIs     | Not implemented                                           |
| Multiple items per message              | Planned; parser currently returns one object              |
| User timezone-aware dates               | Planned; prompt currently uses the UTC date               |
| Discord integration                     | Planned                                                   |
| Server-side token revocation            | Proposed separately; logout currently clears cookies only |

## Target behavior

- Users register through the application and link a bot account using a short-lived, single-use API key.
- Expense commands resolve the linked owner, parse one or more items, and save immediately without a confirmation step.
- Fixed global categories classify expenses; an uncategorized fallback handles unmatched items. The parser currently uses a hardcoded list, not seeded category rows.
- Users view and correct their own expenses through the dashboard or bot.
- Store an expense date separately from timestamps for day/month grouping. Resolve relative dates using the user's timezone.
- Support multiple bot platforms through generic platform and platform-user IDs.

Budgeting, reporting, and edit history are outside the initial product scope. Edits overwrite existing values.

## Current limitations

The expense command does not enforce account linking, persist its result, or support multiple items. Linking success must not be interpreted as enabling storage yet. See the [server README](../server/README.md) for the actual available API and bot commands.
