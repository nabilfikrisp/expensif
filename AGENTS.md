# Agent instructions

This file routes repository work and defines mandatory working rules.

## Hard rules

- Never create git commits. The maintainer strictly reviews all generated code and creates commits personally.
- Always use pnpm.
- Never run `drizzle-kit push` or `db:push`. Generate SQL migrations with `drizzle-kit generate`, have the maintainer commit them, then apply with `drizzle-kit migrate`. Never change the database schema directly. If an existing migration covers the change, migrate only; do not regenerate.
- Tests use real PostgreSQL and truncate application tables: run only against the test database. Development and test databases share host port 5433; never run both together. Setup: [README](README.md#checks-and-tests).

## Work correctly

- Follow [architecture rules](docs/architecture.md); they are mandatory, though future improvements remain possible. Preserve `init*` factories and the layer split. Before new module code, read the [reference module](server/src/modules/api-key/).
- No workarounds to make tests or features pass. If the correct solution needs a design change, violates architecture, or touches code outside the task, stop and ask. Disclose unavoidable deviations and their reasons in the change summary.

## Fail loudly

- No empty catches, silent fallbacks, or success reports for failed operations.
- Translate only handled errors; rethrow unknown errors. Follow [linked-account/use-case.ts](server/src/modules/linked-account/use-case.ts).
- Process boundaries (`bot.catch`, HTTP error handler) may catch failures to keep running, but must log at error level with context.
- Startup failures must fail the process.
- Comment intentional silent behavior with its reason, such as not revealing whether a burned key exists.

## Documentation and scope

- Rationale is maintainer-only. Never write, infer, improve, or reconstruct reasons from code, history, or commits. Missing reasons stay `TODO(maintainer)`; adding placeholders is allowed. Flag outdated or contradicted rationale in the summary without editing it.
- Backlog items require explicit assignment. For a newly found problem outside scope, add a kebab-case file under `docs/backlogs/` with `Problem:`, `Evidence:`, and `Done when:`; mention it without fixing it. Delete completed assigned items in the same commit. Product questions remain open rationale items, not tasks. Known gaps enter the backlog when the maintainer schedules work.
- Only the maintainer decides whether target or code changes when they disagree. Agents may verify and record evidence in [status](docs/status.md); never reconcile either side without instruction.
- Update affected documentation in the same commit as code, including [status](docs/status.md), [data model](docs/data-model.md), and the [session proposal](docs/session-revocation.md). Targets never describe actual behavior. Write documentation in English; keep facts in one place and use relative links.
- Keep required reading one-way: start here and follow the task's reading path without circular prerequisites. Documents must stand on their own. Cross-references may link in either direction when they supply evidence or context; they do not require rereading a document. Avoid redundant links and keep links and anchors valid. No global document order or ban on reference-link cycles is required.

## Reading paths

Read code for actual behavior; target documents describe intent.

| Task | Read |
| --- | --- |
| Any task | This file, then [glossary](docs/glossary.md) and [status](docs/status.md) |
| Assigned backlog | Assigned item in [backlogs](docs/backlogs/), then area documents |
| Code changes | [Architecture](docs/architecture.md), then [reference module](server/src/modules/api-key/) |
| Schema | [Data model](docs/data-model.md) |
| Product behavior | [Product intent](docs/product-intent.md) |
| Sessions or tokens | [Session proposal](docs/session-revocation.md) |
| Commands, API, configuration | [Server README](server/README.md), [root README](README.md), [package scripts](package.json) |
