import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const commands = [
  [process.execPath, "node_modules/typescript/bin/tsc", "--project", "tsconfig.engine.json"],
  [process.execPath, "--test", ".engine-tests/tests/engine.test.js"],
];
let status = 0;
try {
  for (const [command, ...args] of commands) {
    const result = spawnSync(command, args, { stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) { status = result.status ?? 1; break; }
  }
} finally { rmSync(".engine-tests", { recursive: true, force: true }); }
process.exit(status);
