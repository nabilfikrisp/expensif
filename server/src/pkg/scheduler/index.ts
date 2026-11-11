import type { Logger } from "@/pkg/logger";

interface InitScheduledJob {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
  logger: Logger;
}

export function initScheduledJob({ name, intervalMs, run, logger }: InitScheduledJob) {
  if (!Number.isInteger(intervalMs) || intervalMs <= 0 || intervalMs > 2_147_483_647) {
    throw new Error("Scheduled job interval must be a positive 32-bit integer");
  }
  let started = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void> | undefined;

  async function execute() {
    await run();
    logger.info({ job: name }, "Scheduled job completed");
  }

  function schedule() {
    if (stopped) {
      return;
    }
    // Schedule after completion so a slow run cannot overlap its next run.
    timer = setTimeout(() => {
      active = execute()
        .catch((err: unknown) => {
          // This process boundary logs failures and retries on the next scheduled run.
          logger.error({ err, job: name }, "Scheduled job failed");
        })
        .finally(() => {
          active = undefined;
          schedule();
        });
    }, intervalMs);
  }

  return {
    async start() {
      if (started || stopped) {
        throw new Error(`Scheduled job ${name} cannot be started again`);
      }
      started = true;
      active = execute();
      try {
        // Run at startup too, so frequent restarts cannot postpone cleanup indefinitely.
        await active;
      } catch (err: unknown) {
        stopped = true;
        logger.error({ err, job: name }, "Scheduled job startup failed");
        throw err;
      } finally {
        active = undefined;
      }
      schedule();
    },
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await active;
    },
  };
}
