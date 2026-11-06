// Run from server/: pnpm test:standalone:http-logging
import pino from "pino";
import assert from "node:assert/strict";

import type { EnvSchema } from "@/pkg/env";
import { initHttp } from "@/pkg/http";
import { initRateLimit } from "@/pkg/http/rate-limit";

const env: EnvSchema = {
  NODE_ENV: "test",
  PORT: 0,
  DEPLOY_PROXY: "none",
  DATABASE_URL: "unused",
  TELEGRAM_BOT_TOKEN: "unused",
  OPENROUTER_API_KEY: "unused",
  OPENROUTER_MODEL: "unused",
  JWT_SECRET: "unused",
  ACCESS_TOKEN_EXPIRES_IN_MINUTES: "15m",
  REFRESH_TOKEN_EXPIRES_IN_DAYS: "7d",
  API_KEY_SECRET: "unused",
  API_KEY_REDEEM_WINDOW_MINUTES: 15,
};

function setup(limit = 100) {
  const logs: string[] = [];
  const logger = pino({ level: "info" }, { write: (line) => logs.push(line) });
  const app = initHttp(env, logger, [], {
    defaultLimiter: initRateLimit({ limit, windowMs: 60_000, keyGenerator: () => "test" }),
  });
  return { app, logs };
}

function streamingRequest(body: ReadableStream<Uint8Array>, headers?: HeadersInit) {
  const init: RequestInit & { duplex: "half" } = {
    method: "POST",
    body,
    headers,
    duplex: "half",
  };
  return new Request("http://localhost/echo", init);
}

const timeout = setTimeout(() => {
  throw new Error("HTTP logging checks timed out; a response may be waiting for its body");
}, 5000);

try {
  {
    const { app, logs } = setup();
    let calls = 0;
    app.post("/echo", async (c) => {
      calls++;
      return c.json(await c.req.json());
    });
    const body = JSON.stringify({ value: "x".repeat(128 * 1024) });
    const response = await app.request("/echo", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": String(body.length) },
      body,
    });
    assert.equal(response.status, 413);
    assert.equal(calls, 0);
    assert.match(logs.join(""), /"status":413/);
    assert.ok(logs.join("").length < 1024);

    // Without Content-Length, reject while capturing rather than after reading everything.
    let pulls = 0;
    const request = streamingRequest(
      new ReadableStream({
        pull(controller) {
          const chunk = pulls++ === 0 ? '{"value":"' : "x".repeat(16 * 1024);
          controller.enqueue(new TextEncoder().encode(chunk));
          if (pulls === 32) {
            controller.enqueue(new TextEncoder().encode('"}'));
            controller.close();
          }
        },
      }),
      { "Content-Type": "application/json" }
    );
    assert.equal((await app.request(request)).status, 413);
    assert.equal(calls, 0);
    assert.ok(pulls < 32, "size enforcement must stop reading an oversized body");

    // Accepted bodies remain readable by the route, including the exact byte limit.
    const accepted = JSON.stringify({ value: "x".repeat(64 * 1024 - 12) });
    assert.equal(Buffer.byteLength(accepted), 64 * 1024);
    const acceptedResponse = await app.request("/echo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: accepted,
    });
    assert.equal(acceptedResponse.status, 200);
    assert.equal(await acceptedResponse.text(), accepted);
    assert.equal(calls, 1);
    assert.ok(logs.join("").length < 2048);
  }

  {
    const { app, logs } = setup(1);
    app.post("/echo", (c) => c.text("accepted"));
    assert.equal((await app.request("/echo", { method: "POST" })).status, 200);
    let pulls = 0;
    const request = streamingRequest(
      new ReadableStream(
        {
          pull(controller) {
            pulls++;
            controller.enqueue(new Uint8Array(128 * 1024));
          },
        },
        { highWaterMark: 0 }
      )
    );
    assert.equal((await app.request(request)).status, 429);
    assert.equal(request.bodyUsed, false);
    assert.equal(pulls, 0, "rate-limited requests must not read the body");
    assert.match(logs.join(""), /"status":429/);
  }

  {
    const { app, logs } = setup();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
        controller.enqueue(new TextEncoder().encode("first chunk"));
      },
    });
    app.get("/stream", () => new Response(stream));
    try {
      const response = await app.request("/stream");
      assert.equal(response.body, stream, "logging must not clone or replace response streams");
      assert.equal(stream.locked, false, "logging must not read response streams");
      const reader = response.body.getReader();
      assert.equal(new TextDecoder().decode((await reader.read()).value), "first chunk");
      assert.match(logs.join(""), /"status":200/);
      controller.close();
      assert.equal((await reader.read()).done, true);
      reader.releaseLock();
    } finally {
      if (!stream.locked) {
        await stream.cancel();
      }
    }
  }

  {
    const { app, logs } = setup();
    const key = `ek_${"a".repeat(32)}`;
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzZWNyZXQifQ.signature";
    const secret = 'password with "quotes" and \\slashes';
    app.post("/secret/:value", async (c) => {
      c.header("Set-Cookie", `refresh_token=${jwt}`);
      return c.json(await c.req.json());
    });
    const response = await app.request(`/secret/${key}?token=${jwt}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
        Cookie: `refresh_token=${jwt}`,
        "X-CSRF-Token": secret,
        "X-Request-Id": key,
      },
      body: JSON.stringify({ password: secret, nested: { key, accessToken: jwt } }),
    });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /password/);
    const output = logs.join("");
    for (const value of [key, jwt, "password", "quotes", "slashes"]) {
      assert.ok(!output.includes(value), `secret leaked into logs: ${value}`);
    }
    assert.match(output, /\[REDACTED\]/);
    assert.match(output, /\/secret\/:value/);
  }

  {
    const { app, logs } = setup();
    app.get("/failure", () => {
      throw new Error("unexpected failure");
    });
    const response = await app.request("/failure", { headers: { "X-Request-Id": "failure-id" } });
    assert.equal(response.status, 500);
    const output = logs.join("");
    assert.match(output, /Internal server error/);
    assert.match(output, /"level":50/);
    assert.match(output, /"reqId":"failure-id"/);
    assert.match(output, /unexpected failure/);
    assert.match(output, /\/failure/);
  }

  console.log("HTTP size limits, rate-limit ordering, streaming, redaction, and errors passed.");
} finally {
  clearTimeout(timeout);
}
