# Agent instructions

This file routes repository work and defines mandatory working rules.

## Hard rules

- Never create git commits. The maintainer strictly reviews all generated code and creates commits personally.
- Always use pnpm.
- Never run `drizzle-kit push` or `db:push`. Generate SQL migrations with `drizzle-kit generate`, have the maintainer commit them, then apply with `drizzle-kit migrate`. Never change the database schema directly. If an existing migration covers the change, migrate only; do not regenerate.
- Every migration requires explicit maintainer approval before implementation or execution, even when the database is empty. Approval applies only to that migration; it does not authorize future migrations.
- Tests use real PostgreSQL and truncate application tables: run only against the test database. Development uses host port 5433; tests use 5434. Use the test runner to manage the test database lifecycle. Setup: [README](README.md#checks-and-tests).

## Work correctly

- Follow [architecture rules](docs/architecture.md); they are mandatory. Preserve `init*` factories and the layer split. Use dedicated operation factory files under `service/` and `use-case/`, one explicit module interface per layer, and one independent, method-named `dto.ts` per layer. Small stateless utilities stay in the layer's `index.ts` without factory wrappers, including utilities exposed by its interface. Consumers depend on layer interfaces; callers map DTOs directly. Before new module code, read the [reference module](server/src/modules/api-key/).
- No workarounds to make tests or features pass. If the correct solution needs a design change, violates architecture, or touches code outside the task, stop and ask. Disclose unavoidable deviations and their reasons in the change summary.

## Fail loudly

- No empty catches, silent fallbacks, or success reports for failed operations.
- Translate only handled errors; rethrow unknown errors. Follow [linked-account redemption use case](server/src/modules/linked-account/use-case/redeem-api-key.ts).
- Process boundaries (`bot.catch`, HTTP error handler) may catch failures to keep running, but must log at error level with context.
- Startup failures must fail the process.
- Comment intentional silent behavior with its reason, such as not revealing whether a burned key exists.

## Documentation and scope

- Rationale is maintainer-only. Never write, infer, improve, or reconstruct reasons from code, history, or commits. Missing reasons stay `TODO(maintainer)`; adding placeholders is allowed. Flag outdated or contradicted rationale in the summary without editing it.
- Backlog work requires explicit assignment; report out-of-scope issues without fixing them. Get approval before creating `docs/backlogs/p{1,2,3}-<kebab-case-topic>.md` with `Problem:`, `Evidence:`, and `Done when:`. The maintainer sets priority: P1 = next (reliability/security), P2 = soon (correctness/maintenance), P3 = when touching the area. Use `Blocked by:` only while blocked; name the prerequisite or link its backlog file relatively. Update links after renames; delete completed assigned items in the same change. Product questions stay in rationale, not the backlog.
- Only the maintainer decides whether target or code changes when they disagree. Agents may verify and record evidence in [status](docs/status.md); never reconcile either side without instruction.
- Documentation contains intent, maintainer rationale, architecture rules, setup, and concise capability status. Test each addition: can this be read from code, tests, or OpenAPI? If so, do not duplicate it in prose. Keep implementation mechanics in code and tests; request/response contracts belong to OpenAPI. README content is limited to discovery (route table and a one-sentence purpose), setup, commands, configuration, and migration data-loss warnings. Review README content against these boundaries; it is not exempt from review.
- Default to no documentation change. Update existing docs only when a statement becomes incorrect or a capability gap opens or closes; include those corrections in the same change as the code for the maintainer to commit. Correct or remove inaccurate statements, update evidence-backed status rows, and add `TODO(maintainer)` entries as needed. Targets never describe actual behavior. Write documentation in English; keep facts in one place and use relative links.
- New documents, sections/headings, and README paragraphs require explicit maintainer approval before creation. An assigned task authorizes them only if it explicitly includes those additions. If an edit would take a document beyond approximately 2,000 tokens, stop and request approval before making that edit.
- Report verification commands and results in the agent response, not documentation. [Status](docs/status.md) records concise capability gaps and material verification limitations that still apply, one line per item with a code path or commit as evidence; do not append verification history.
- Every change summary must include one documentation line naming the documents checked and what changed, or why no documentation change was needed.
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
| Sessions or tokens | [Authentication follow-up](docs/auth-follow-up.md) |
| Commands, API, configuration | [Server README](server/README.md), [root README](README.md), [package scripts](package.json) |
