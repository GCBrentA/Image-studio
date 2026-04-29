import assert from "node:assert/strict";
import { app } from "../src/app";

const main = async (): Promise<void> => {
  const server = app.listen(0);

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start test server");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const health = await fetch(`${baseUrl}/api/image-studio/health`);
    assert.equal(health.status, 200, "Image Studio health route should be mounted");
    const healthBody = await health.json() as { ok?: boolean; routes?: string[] };
    assert.equal(healthBody.ok, true, "Health route should return ok true");
    assert.ok(
      healthBody.routes?.includes("POST /api/image-studio/audits/start"),
      "Health route should list audit start route"
    );

    const start = await fetch(`${baseUrl}/api/image-studio/audits/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "woocommerce", scan_options: {} })
    });
    const startBody = await start.json().catch(() => ({})) as { error?: { message?: string } };
    assert.notEqual(start.status, 404, "Audit start route must not be a route-not-found 404");
    assert.notEqual(
      startBody.error?.message,
      "Route not found: POST /api/image-studio/audits/start",
      "Audit start must not hit the catch-all route"
    );

    const duplicated = await fetch(`${baseUrl}/api/api/image-studio/health`);
    assert.equal(duplicated.status, 404, "Duplicated /api/api image-studio route should not exist");

    const duplicatedStart = await fetch(`${baseUrl}/api/api/image-studio/audits/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "woocommerce", scan_options: {} })
    });
    assert.equal(duplicatedStart.status, 404, "Duplicated /api/api image-studio audit start route should not exist");

    console.log("Image audit route checks passed.");
  } finally {
    server.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
