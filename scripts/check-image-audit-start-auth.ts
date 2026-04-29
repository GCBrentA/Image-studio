import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { app } from "../src/app";
import { generateApiToken, hashApiToken } from "../src/utils/apiToken";
import { prisma } from "../src/utils/prisma";

const runPhpWordPressClientCheck = async (baseUrl: string, token: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn("php", ["scripts/check-wordpress-audit-client.php"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPTIVRA_TEST_API_BASE_URL: baseUrl,
        OPTIVRA_TEST_API_TOKEN: token,
        OPTIVRA_TEST_INSTALL_ID: `audit-client-${Date.now()}`
      }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`WordPress SaaS client should complete scan flow through real HTTP helper.\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`));
    });
  });

const main = async (): Promise<void> => {
  const token = generateApiToken();
  const email = `image-audit-e2e-${Date.now()}@example.test`;
  const user = await prisma.user.create({
    data: {
      email,
      password_hash: "test-only"
    },
    select: {
      id: true
    }
  });

  const site = await prisma.connectedSite.create({
    data: {
      user_id: user.id,
      domain: "localhost",
      canonical_domain: "localhost",
      api_token_hash: hashApiToken(token),
      claim_status: "staging"
    },
    select: {
      id: true
    }
  });

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start test server");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Optivra-Site-Url": "http://localhost",
    "X-Optivra-Home-Url": "http://localhost",
    "X-Optivra-WordPress-Install-Id": `audit-e2e-${Date.now()}`,
    "X-Optivra-Plugin-Version": "test"
  };

  try {
    const usage = await fetch(`${baseUrl}/usage`, { headers });
    const usageBody = await usage.json() as { site_id?: string; store_id?: string; error?: string };
    assert.equal(usage.status, 200, `Usage should authenticate site token: ${JSON.stringify(usageBody)}`);
    assert.equal(usageBody.site_id, site.id, "Usage should return connected site id");
    assert.equal(usageBody.store_id, site.id, "Usage should return store id alias");

    const staleLocalStoreId = "11111111-2222-4333-8444-555555555555";
    const start = await fetch(`${baseUrl}/api/image-studio/audits/start`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        store_id: staleLocalStoreId,
        source: "woocommerce",
        scan_options: {
          total_products_estimate: 1
        }
      })
    });
    const startBody = await start.json() as { scan_id?: string; status?: string; error?: string };
    assert.equal(start.status, 201, `Audit start should ignore stale body store_id for site token: ${JSON.stringify(startBody)}`);
    assert.ok(startBody.scan_id, "Audit start should return scan_id");
    assert.equal(startBody.status, "running", "Audit start should return running status");

    const scan = await prisma.imageAuditScan.findUnique({
      where: {
        id: startBody.scan_id
      },
      select: {
        store_id: true,
        status: true
      }
    });
    assert.equal(scan?.store_id, site.id, "Audit scan row should use authenticated connected site id");
    assert.equal(scan?.status, "running", "Audit scan row should be running");

    const items = await fetch(`${baseUrl}/api/image-studio/audits/${encodeURIComponent(startBody.scan_id)}/items`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        items: Array.from({ length: 100 }, (_, index) => ({
          product_id: `1001-${index}`,
          product_name: `E2E Test Product ${index}`,
          product_url: `http://localhost/product/e2e-test-product-${index}`,
          image_id: `2001-${index}`,
          image_url: `http://localhost/wp-content/uploads/e2e-test-product-${index}.jpg`,
          image_role: index % 3 === 0 ? "main" : "gallery",
          filename: `e2e-test-product-${index}.jpg`,
          mime_type: "image/jpeg",
          width: 1200,
          height: 1200,
          file_size_bytes: 204800,
          alt_text: index % 2 === 0 ? `E2E test product ${index}` : ""
        }))
      })
    });
    const itemsBody = await items.json() as { inserted?: number; error?: string };
    assert.equal(items.status, 201, `Audit items should be accepted: ${JSON.stringify(itemsBody)}`);
    assert.equal(itemsBody.inserted, 100, "Audit items should report 100 inserted items");

    const complete = await fetch(`${baseUrl}/api/image-studio/audits/${encodeURIComponent(startBody.scan_id)}/complete`, {
      method: "POST",
      headers,
      body: JSON.stringify({})
    });
    const completeBody = await complete.json() as { ok?: boolean; status?: string; error?: string };
    assert.equal(complete.status, 200, `Audit complete should succeed: ${JSON.stringify(completeBody)}`);
    assert.equal(completeBody.ok, true, "Audit complete should return ok true");
    assert.equal(completeBody.status, "completed", "Audit complete should return completed status");

    const phpClientOutput = await runPhpWordPressClientCheck(baseUrl, token);
    const phpClientBody = JSON.parse(phpClientOutput) as { ok?: boolean; scan_id?: string; status?: string };
    assert.equal(phpClientBody.ok, true, "WordPress client scan check should return ok true");
    assert.ok(phpClientBody.scan_id, "WordPress client scan check should return scan_id");
    assert.equal(phpClientBody.status, "completed", "WordPress client scan check should complete");

    console.log(JSON.stringify({
      ok: true,
      usage_store_id: usageBody.store_id,
      scan_id: startBody.scan_id,
      scan_status: completeBody.status,
      wordpress_client_scan_id: phpClientBody.scan_id,
      stale_store_id_overridden: true
    }, null, 2));
  } finally {
    server.close();
    await prisma.user.delete({
      where: {
        id: user.id
      }
    }).catch(() => undefined);
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
