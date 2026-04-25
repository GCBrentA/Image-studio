const { existsSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const serverPath = path.join(__dirname, "..", "dist", "server.js");

if (!existsSync(serverPath)) {
  console.warn("Compiled server entry dist/server.js is missing. Rebuilding before start.");

  const build = spawnSync("npm", ["run", "build"], {
    cwd: path.join(__dirname, ".."),
    shell: process.platform === "win32",
    stdio: "inherit"
  });

  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
}

require(serverPath);
