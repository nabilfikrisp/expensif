import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { mkdir, rmdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const serverDir = path.resolve(import.meta.dirname, "..");
const composeFile = path.resolve(serverDir, "../docker/compose.test.yml");
const lockDir = path.join(serverDir, "node_modules/.cache/expensif-test.lock");
const require = createRequire(import.meta.url);
const vitest = path.join(path.dirname(require.resolve("vitest/package.json")), "vitest.mjs");
const compose = ["compose", "-f", composeFile];

let activeChild: ChildProcess | undefined;
let killTimer: NodeJS.Timeout | undefined;
let interrupted: NodeJS.Signals | undefined;

function interrupt(signal: NodeJS.Signals) {
  if (interrupted) {
    return;
  }
  interrupted = signal;
  if (activeChild) {
    const child = activeChild;
    child.kill(signal);
    killTimer = setTimeout(() => child.kill("SIGKILL"), 10_000);
  }
}

const onSigint = () => {
  interrupt("SIGINT");
};
const onSigterm = () => {
  interrupt("SIGTERM");
};

async function run(command: string, args: string[], capture = false, cleanup = false) {
  if (interrupted && !cleanup) {
    throw new Error(`Interrupted by ${interrupted}`);
  }

  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: serverDir,
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
      // Keep terminal signals from interrupting database cleanup on Unix.
      detached: cleanup && process.platform !== "win32",
    });
    if (!cleanup) {
      activeChild = child;
    }
    let output = "";
    child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
      output += chunk;
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (activeChild === child) {
        activeChild = undefined;
      }
      clearTimeout(killTimer);
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`${command} exited with ${signal ?? `status ${code}`}`));
      }
    });
  });
}

async function main() {
  await mkdir(path.dirname(lockDir), { recursive: true });
  try {
    await mkdir(lockDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(
        `Another test runner holds ${lockDir}. If it was forcibly terminated, stop the test container and remove this directory before retrying.`
      );
    }
    throw error;
  }

  let ownsContainer = false;
  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);

  try {
    const running = await run("docker", [...compose, "ps", "--status", "running", "--quiet"], true);
    if (running) {
      throw new Error(
        "The test container is already running. Stop it with pnpm db:test:down from the repository root before retrying."
      );
    }

    // Startup can create the container before failing, so cleanup owns partial startup too.
    ownsContainer = true;
    await run("docker", [...compose, "up", "--detach", "--wait", "--wait-timeout", "60"]);
    await run(process.execPath, [vitest, ...process.argv.slice(2)]);
  } catch (error) {
    // Report the original failure even if cleanup subsequently fails as well.
    console.error(error);
    process.exitCode = 1;
  } finally {
    try {
      if (ownsContainer) {
        await run("docker", [...compose, "down", "--timeout", "10"], false, true);
      }
    } finally {
      await rmdir(lockDir);
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
    }
  }
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (interrupted) {
    process.exitCode = interrupted === "SIGINT" ? 130 : 143;
  }
}
