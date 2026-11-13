import type { OpenAPIHono } from "@hono/zod-openapi";
import type { TestContext } from "./app";
import { seedUser } from "./auth";
import { generateApiKeyRespSchema } from "@/modules/api-key/controllers/http/generate";
import { listLinkedAccountsRespSchema } from "@/modules/linked-account/controllers/http/list";
import { API_PREFIX } from "@/pkg/http";

export async function createLinkedUser(context: TestContext, name: string) {
  const { accessToken } = await seedUser(context, {
    email: `${name}@example.com`,
    name,
  });
  const headers = { Authorization: `Bearer ${accessToken}` };
  const { key } = await createApiKey(context.app, accessToken, "telegram");
  // Linking is a bot operation; seed through its use case, then exercise HTTP ownership.
  await context.useCases.linkedAccount.redeemApiKey({
    token: key,
    platform: "telegram",
    platformUserId: name,
    idempotencyKey: `test:link:${name}`,
  });
  const res = await context.app.request(`${API_PREFIX}/linked-accounts`, { headers });
  if (res.status !== 200) {
    throw new Error(`Linked-account listing failed: ${res.status}`);
  }
  const { data } = listLinkedAccountsRespSchema.parse(await res.json());
  if (data.length !== 1) {
    throw new Error("Expected one linked account");
  }
  return { headers, account: data[0] };
}

export async function createApiKey(app: OpenAPIHono, accessToken: string, label?: string) {
  const response = await app.request(`${API_PREFIX}/api-keys`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  if (response.status !== 201) {
    throw new Error(`Key creation failed: ${response.status}`);
  }
  return generateApiKeyRespSchema.parse(await response.json()).data;
}
