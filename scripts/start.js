const { existsSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const serverPath = path.join(__dirname, "..", "dist", "server.js");
const rootPath = path.join(__dirname, "..");

if (process.env.SKIP_PRISMA_MIGRATE_DEPLOY !== "1") {
  console.log("Applying production database migrations before start.");

  const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: rootPath,
    shell: process.platform === "win32",
    stdio: "inherit"
  });

  if (migrate.status !== 0) {
    process.exit(migrate.status ?? 1);
  }
}

if (!existsSync(serverPath)) {
  console.warn("Compiled server entry dist/server.js is missing. Rebuilding before start.");

  const build = spawnSync("npm", ["run", "build"], {
    cwd: rootPath,
    shell: process.platform === "win32",
    stdio: "inherit"
  });

  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
}

require(serverPath);
