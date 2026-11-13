// Run from server/: pnpm test:standalone:env-validation
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { initEnv } from "@/pkg/env";

// Environment validation exits the process, so verify its diagnostics in a subprocess.
if (process.argv[2] === "invalid-env") {
  initEnv();
  throw new Error("Invalid environment must fail before logger initialization");
} else {
  const invalid = spawnSync(
    process.execPath,
    ["--import", "tsx", fileURLToPath(import.meta.url), "invalid-env"],
    { encoding: "utf8", timeout: 5000, env: { ...process.env, DATABASE_URL: "" } }
  );
  assert.ifError(invalid.error);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Environment validation failed:/);
  assert.match(invalid.stderr, /DATABASE_URL/);
  console.log("Invalid environment reports diagnostics and exits nonzero.");
}
