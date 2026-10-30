import "../src/config/loadEnv.js";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const result = spawnSync(process.execPath, [require.resolve("prisma"), ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env
});

if (result.error) console.error("Unable to start the installed Prisma CLI.");
process.exit(result.status ?? 1);
