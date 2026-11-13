import { beforeAll, beforeEach, expect, it } from "vitest";

import { listApiKeysRespSchema } from "@/modules/api-key/controllers/http/list";
import { API_PREFIX } from "@/pkg/http";
import { initTest } from "@/test/helper/app";
import { createLinkedUser } from "@/test/helper/linked-account";

let ctx: Awaited<ReturnType<typeof initTest>>;

beforeAll(async () => {
  ctx = await initTest();
  return () => ctx.client.end();
});

beforeEach(async () => {
  await ctx.resetDb();
});

it("publishes plural resource paths and preserves authentication actions in OpenAPI", async () => {
  const response = await ctx.app.request(`${API_PREFIX}/doc`);
  expect(response.status).toBe(200);
  const document = (await response.json()) as { paths: Record<string, Record<string, unknown>> };
  const methods = Object.fromEntries(
    Object.entries(document.paths).map(([path, operations]) => [
      path,
      Object.keys(operations).sort(),
    ])
  );
  expect(methods).toEqual({
    [`${API_PREFIX}/auth/register`]: ["post"],
    [`${API_PREFIX}/auth/login`]: ["post"],
    [`${API_PREFIX}/auth/csrf`]: ["get"],
    [`${API_PREFIX}/auth/refresh`]: ["post"],
    [`${API_PREFIX}/auth/logout`]: ["post"],
    [`${API_PREFIX}/auth/logout-all`]: ["post"],
    [`${API_PREFIX}/auth/change-password`]: ["post"],
    [`${API_PREFIX}/users/me`]: ["delete", "get"],
    [`${API_PREFIX}/api-keys`]: ["get", "post"],
    [`${API_PREFIX}/api-keys/{id}`]: ["delete"],
    [`${API_PREFIX}/api-keys/{id}/revoke`]: ["post"],
    [`${API_PREFIX}/linked-accounts`]: ["get"],
    [`${API_PREFIX}/linked-accounts/{id}`]: ["delete"],
  });
});

it("rejects retired routes without redirects or changes to owned resources", async () => {
  const { headers, account } = await createLinkedUser(ctx, "route-owner");
  const paths = ["/users/me", "/api-keys?status=all", "/linked-accounts"];
  const before: unknown[] = [];
  for (const path of paths) {
    const response = await ctx.app.request(`${API_PREFIX}${path}`, { headers });
    expect(response.status).toBe(200);
    before.push(await response.json());
  }
  const key = listApiKeysRespSchema.parse(before[1]).data[0];
  for (const [method, path] of [
    ["GET", "/auth/me"],
    ["DELETE", "/user/me"],
    ["POST", "/api-key"],
    ["GET", "/api-key"],
    ["PATCH", `/api-key/${key.id}`],
    ["DELETE", `/api-key/${key.id}`],
    ["GET", "/linked-account"],
    ["DELETE", `/linked-account/${account.id}`],
    ["PATCH", `/api-keys/${key.id}`],
  ]) {
    const response = await ctx.app.request(`${API_PREFIX}${path}`, {
      method,
      headers,
      redirect: "manual",
    });
    expect(response.status, `${method} ${path}`).toBe(404);
    expect(response.headers.get("Location")).toBeNull();
    expect(await response.json()).toMatchObject({ error: "NOT_FOUND" });
  }
  for (const [index, path] of paths.entries()) {
    const response = await ctx.app.request(`${API_PREFIX}${path}`, { headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(before[index]);
  }
});
