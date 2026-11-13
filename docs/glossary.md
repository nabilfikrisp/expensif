---
status: active
updated: 2026-11-13
---

# Glossary

This document gives repository terms one meaning and distinguishes terms that are easy to confuse.

Definitions explain vocabulary, not implementation completeness. Check [status](status.md) for what works and [product intent](product-intent.md) for targets. “Also called” records names used in code or earlier notes; it does not introduce a separate concept.

## Identity and linking

| Term             | Meaning                                                                                                                                       | Also called                                             | Evidence                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| User             | An application account that owns its data; distinct from a Telegram or other platform account.                                                | Owner; `userId` identifies it                           | [User schema](../server/src/modules/user/schema.ts), [ownership rule](architecture.md#mandatory-rules)                        |
| Platform         | The external messaging system associated with an account.                                                                                     | `platform`                                              | [Linked-account model](data-model.md#linked_accounts)                                                                         |
| Platform user ID | An account's identity within a platform. Combined with the platform, it identifies the external account; its username is display information. | `platformUserId`                                        | [Linked-account model](data-model.md#linked_accounts)                                                                         |
| Linked account   | The association between an application user and an external platform account.                                                                 | `linkedAccount`; `linked_accounts`                      | [Linked-account model](data-model.md#linked_accounts)                                                                         |
| Linking          | Establishing that association by redeeming a linking key. Successful linking does not imply that expenses are saved.                          | Account linking; redemption                             | [Product intent](product-intent.md#intended-experience), [linking use case](../server/src/modules/linked-account/use-case/index.ts) |
| API key          | The repository's account-linking credential, not the bearer token used for ordinary API authentication.                                       | Linking key; plaintext `key`; `token` in linking inputs | [Product intent](product-intent.md#intended-experience), [key model](data-model.md#api_keys)                                  |

## Key state and operations

These terms describe different conditions or operations; “active” alone does not mean “redeemable.”

| Term           | Meaning                                                                                                                             | Also called                               | Evidence                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Active key     | A key whose `revokedAt` is null. This listing filter includes used and expired keys.                                                | `status: "active"`                        | `listApiKeys` in [API-key service](../server/src/modules/api-key/service/index.ts)                                                           |
| Redeemable key | A matching key that is unused, unrevoked, and unexpired when consumption can proceed, including time spent waiting for its lock.    | Valid key for consumption                 | `consumeApiKey` in [API-key service](../server/src/modules/api-key/service/index.ts)                                                         |
| Consume        | Atomically mark a redeemable key used as part of linking. The enclosing transaction rolls this back if linking fails.               | `consumeApiKey`                           | [API-key service](../server/src/modules/api-key/service/index.ts), [linking use case](../server/src/modules/linked-account/use-case/index.ts)      |
| Burn           | Revoke a matching exposed key without linking an account or changing its usage timestamp. Does not disclose whether the key exists. | `burnApiKey`; “disabled” in the bot reply | [API-key service](../server/src/modules/api-key/service/index.ts), [bot controller](../server/src/modules/linked-account/controllers/bot.ts) |
| Revoke a key   | Set the key's revocation timestamp so it cannot be redeemed. Does not remove an existing linked account.                            | `revokeApiKey`; `revokedAt`               | [API-key service](../server/src/modules/api-key/service/index.ts)                                                                            |
| Unlink         | Delete an owned linked-account association. This is distinct from revoking or deleting its original linking key.                    | `unlinkAccount`                           | [Linked-account service](../server/src/modules/linked-account/service/index.ts)                                                              |

## Expense data

| Term         | Meaning                                                                                                                             | Also called                   | Evidence                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| Message      | The original text received from a platform; initial ingestion produces one expense per message. Multiple expenses remain future scope. | Raw message; `messages`       | [Message model](data-model.md#messages)                                         |
| Expense      | One expense item attributed to a user, distinct from the source message. Storage and editing targets do not imply implemented APIs. | Expense item; `expenses`      | [Expense model](data-model.md#expenses), [capabilities](status.md#capabilities) |
| Category     | A global classification for an expense.                                                                                             | `categories`; category slug   | [Category model](data-model.md#categories)                                      |
| Expense date | The date an expense belongs to, separate from timestamps recording when its row was created or updated.                             | `expenseDate`; `expense_date` | [Expense model](data-model.md#expenses)                                         |

## Authentication and layers

| Term            | Meaning                                                                                                                                                  | Also called                            | Evidence                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Access JWT      | The signed bearer credential used to authenticate ordinary API requests. Distinct from a linking key and a refresh token.                                | Access token; `accessToken`            | [Authentication service](../server/src/modules/auth/service/index.ts), [API authentication](../server/README.md#http-api)   |
| Refresh token   | The credential used to obtain new access tokens through a server-tracked refresh session.          | `refreshToken`; `refresh_token` cookie | [Session service](../server/src/modules/session/service/index.ts), [actual behavior](status.md#target-vs-actual)                              |
| Refresh session | The server-tracked validity state associated with refresh tokens. “Current session” in logout means this session, not every login for the user. | Current refresh session                | [Logout decision](product-intent.md#why-a-particular-logout-scope), [session schema](../server/src/modules/session/schema.ts)         |
| DTO             | A method's input or output data shape, independently declared in its module layer's `dto.ts`; callers map between layers.                                                   | Data transfer object                   | [Architecture](architecture.md#mandatory-rules)                                                                       |
| Use case        | The layer that owns a transaction spanning service operations and depends on explicit service interfaces.                                                                               | `init*UseCase`                         | [Architecture](architecture.md#mandatory-rules), [linking use case](../server/src/modules/linked-account/use-case/index.ts) |
| Layer interface | The explicit module contract in `service/interface.ts` or `use-case/interface.ts`; the layer's `index.ts` composes method factories and returns it. | `ApiKeyService`; `init*Service`; `init*UseCase` | [Architecture](architecture.md#mandatory-rules) |
