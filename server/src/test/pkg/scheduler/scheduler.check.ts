import assert from "node:assert/strict";
import { mock } from "node:test";
import { setImmediate as flush } from "node:timers/promises";

import { initLogger } from "@/pkg/logger";
import { initScheduledJob } from "@/pkg/scheduler";

const logs: string[] = [];
// Timer and failure behavior cannot be exercised through request-driven flows.
const root = initLogger(
  { NODE_ENV: "production" },
  {
    write(line) {
      const entry = JSON.parse(line) as { service: string; job: string };
      assert.equal(entry.service, "scheduler");
      assert.ok(entry.job);
      logs.push(line);
    },
  }
);
const logger = root.child({ service: "scheduler" });
const intervalMs = 24 * 60 * 60 * 1000;
mock.timers.enable({ apis: ["setTimeout"] });
try {
  let runs = 0;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const job = initScheduledJob({
    name: "non-overlap",
    intervalMs,
    logger,
    run: async () => {
      runs++;
      if (runs === 2) {
        await gate;
      }
    },
  });
  assert.equal(runs, 0);
  await job.start();
  assert.equal(runs, 1);
  mock.timers.tick(intervalMs - 1);
  await flush();
  assert.equal(runs, 1);
  mock.timers.tick(1);
  await flush();
  assert.equal(runs, 2);
  mock.timers.tick(intervalMs * 3);
  await flush();
  assert.equal(runs, 2);
  let stopped = false;
  const stopping = job.stop().then(() => {
    stopped = true;
  });
  await flush();
  assert.equal(stopped, false);
  release();
  await stopping;
  mock.timers.tick(intervalMs * 3);
  await flush();
  assert.equal(runs, 2);
  await job.stop();
  await assert.rejects(job.start(), /cannot be started again/);

  let attempts = 0;
  const retry = initScheduledJob({
    name: "retry",
    intervalMs,
    logger,
    run: () => {
      attempts++;
      if (attempts === 2) {
        return Promise.reject(new Error("scheduled failure"));
      }
      return Promise.resolve();
    },
  });
  await retry.start();
  mock.timers.tick(intervalMs);
  await flush();
  assert.equal(attempts, 2);
  assert.ok(
    logs.some((line) => {
      const entry = JSON.parse(line) as { job?: string; level: number; err?: { message: string } };
      return (
        entry.job === "retry" && entry.level === 50 && entry.err?.message === "scheduled failure"
      );
    })
  );
  mock.timers.tick(intervalMs);
  await flush();
  assert.equal(attempts, 3);
  await retry.stop();

  let failures = 0;
  const startup = initScheduledJob({
    name: "startup",
    intervalMs,
    logger,
    run: () => {
      failures++;
      return Promise.reject(new Error("startup failure"));
    },
  });
  await assert.rejects(startup.start(), /startup failure/);
  mock.timers.tick(intervalMs * 2);
  await flush();
  assert.equal(failures, 1);
  assert.ok(
    logs.some((line) => {
      const entry = JSON.parse(line) as { job?: string; level: number; err?: { message: string } };
      return entry.job === "startup" && entry.level === 50;
    })
  );
  await startup.stop();
} finally {
  mock.timers.reset();
}
console.log(
  "Scheduler startup, daily cadence, non-overlap, failure recovery, and shutdown checks passed."
);
