import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const testEnvironmentPath = path.resolve(".env.test.example");
const command = process.argv[2];
const commandArguments = process.argv.slice(3);

if (!command) {
  throw new Error("A command is required after with-test-env.mjs.");
}

const testEnvironmentFile = await readFile(testEnvironmentPath, "utf8");
const testEnvironment = Object.fromEntries(
  testEnvironmentFile
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const separatorIndex = line.indexOf("=");

      if (separatorIndex === -1) {
        throw new Error(`Invalid test environment entry: ${line}`);
      }

      return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
    })
);

if (
  testEnvironment.VISTA_VALLE_CONFIG_CONTEXT !== "mock" ||
  testEnvironment.BOOKING_ENABLED !== "false"
) {
  throw new Error(
    ".env.test.example must explicitly use mock configuration with bookings disabled."
  );
}

const child = spawn(command, commandArguments, {
  env: { ...process.env, ...testEnvironment },
  stdio: "inherit",
});

function forwardTerminationSignal(signal) {
  if (!child.killed) {
    child.kill(signal);
  }
}

process.once("SIGINT", () => forwardTerminationSignal("SIGINT"));
process.once("SIGTERM", () => forwardTerminationSignal("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
