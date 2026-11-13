// Run from server/: pnpm test:standalone:logging
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { hostname } from "node:os";
import { fileURLToPath } from "node:url";

import { initEnv } from "@/pkg/env";
import { initLogger } from "@/pkg/logger";

// Process identity, stdout serialization, and pre-initialization errors need subprocess checks.
const scenario = process.argv[2];
if (scenario === "startup") {
  const logger = initLogger({ NODE_ENV: "production" });
  logger.child({ service: "runtime" }).info("Runtime ready");
  for (const service of ["api", "bot", "scheduler"]) {
    logger.child({ service }).child({ context: "nested" }).info("Service ready");
  }
} else if (scenario === "invalid-env") {
  initEnv();
  throw new Error("Invalid environment must fail before logger initialization");
} else {
  {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", fileURLToPath(import.meta.url), "startup"],
      { encoding: "utf8", timeout: 5000 }
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const entries = result.stdout
      .trim()
      .split("\n")
      .map(
        (line) =>
          JSON.parse(line) as {
            instanceId?: string;
            service: string;
            hostname: string;
            pid: number;
            context?: string;
          }
      );
    assert.deepEqual(
      entries.map((entry) => entry.service),
      ["runtime", "api", "bot", "scheduler"]
    );
    assert.equal(new Set(entries.map((entry) => entry.pid)).size, 1);
    for (const entry of entries) {
      assert.equal(entry.instanceId, undefined);
      assert.equal(entry.hostname, hostname());
      assert.ok(Number.isInteger(entry.pid) && entry.pid > 0);
      if (entry.service !== "runtime") {
        assert.equal(entry.context, "nested");
      }
    }
  }

  const invalid = spawnSync(
    process.execPath,
    ["--import", "tsx", fileURLToPath(import.meta.url), "invalid-env"],
    { encoding: "utf8", timeout: 5000, env: { ...process.env, DATABASE_URL: "" } }
  );
  assert.ifError(invalid.error);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Environment validation failed:/);
  assert.match(invalid.stderr, /DATABASE_URL/);
  console.log(
    "JSON stdout, process identity, nested service attribution, and environment failures passed."
  );
}
