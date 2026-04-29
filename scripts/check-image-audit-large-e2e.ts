import assert from "node:assert/strict";
import { app } from "../src/app";
import { generateApiToken, hashApiToken } from "../src/utils/apiToken";
import { prisma } from "../src/utils/prisma";

const itemCount = Number(process.env.OPTIVRA_AUDIT_E2E_ITEMS || 500);

const main = async (): Promise<void> => {
  const token = generateApiToken();
  const email = `image-audit-large-e2e-${Date.now()}@example.test`;
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
    "X-Optivra-WordPress-Install-Id": `audit-large-e2e-${Date.now()}`,
    "X-Optivra-Plugin-Version": "test"
  };

  const time = async <T>(label: string, task: () => Promise<T>): Promise<{ value: T; ms: number }> => {
    const started = Date.now();
    const value = await task();
    const ms = Date.now() - started;
    console.log(`${label}: ${ms}ms`);
    return { value, ms };
  };

  try {
    const { value: startBody } = await time("start", async () => {
      const response = await fetch(`${baseUrl}/api/image-studio/audits/start`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          source: "woocommerce",
          scan_options: {
            total_products_estimate: itemCount
          }
        })
      });
      const body = await response.json() as { scan_id?: string; status?: string; error?: string };
      assert.equal(response.status, 201, `start should succeed: ${JSON.stringify(body)}`);
      assert.ok(body.scan_id, "start should return scan_id");
      return body;
    });

    const scanId = startBody.scan_id as string;
    for (let offset = 0; offset < itemCount; offset += 100) {
      const count = Math.min(100, itemCount - offset);
      await time(`items ${offset + 1}-${offset + count}`, async () => {
        const response = await fetch(`${baseUrl}/api/image-studio/audits/${encodeURIComponent(scanId)}/items`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            items: Array.from({ length: count }, (_, index) => {
              const absolute = offset + index;
              return {
                product_id: `large-product-${Math.floor(absolute / 3)}`,
                product_name: `Large E2E Product ${Math.floor(absolute / 3)}`,
                product_url: `http://localhost/product/large-e2e-product-${Math.floor(absolute / 3)}`,
                image_id: `large-image-${absolute}`,
                image_url: `http://localhost/wp-content/uploads/large-e2e-product-${absolute}.jpg`,
                image_role: absolute % 3 === 0 ? "main" : "gallery",
                category_ids: [String(100 + (absolute % 7))],
                category_names: [`Category ${absolute % 7}`],
                filename: absolute % 5 === 0 ? `IMG_${absolute}.jpg` : `large-e2e-product-${absolute}.jpg`,
                mime_type: "image/jpeg",
                width: absolute % 11 === 0 ? 700 : 1200,
                height: absolute % 13 === 0 ? 900 : 1200,
                file_size_bytes: absolute % 4 === 0 ? 2_400_000 : 320_000,
                alt_text: absolute % 2 === 0 ? `Large E2E Product ${Math.floor(absolute / 3)}` : "",
                image_title: absolute % 3 === 0 ? `Large E2E Product ${Math.floor(absolute / 3)}` : ""
              };
            })
          })
        });
        const body = await response.json() as { inserted?: number; error?: string };
        assert.equal(response.status, 201, `items should succeed: ${JSON.stringify(body)}`);
        assert.equal(body.inserted, count, "items should report inserted count");
      });
    }

    const { value: completeBody, ms: completeMs } = await time("complete", async () => {
      const response = await fetch(`${baseUrl}/api/image-studio/audits/${encodeURIComponent(scanId)}/complete`, {
        method: "POST",
        headers,
        body: JSON.stringify({})
      });
      const body = await response.json() as { ok?: boolean; status?: string; metrics?: Record<string, unknown>; issue_summary?: { total?: number }; top_recommendations?: unknown[]; error?: string };
      assert.equal(response.status, 200, `complete should succeed: ${JSON.stringify(body).slice(0, 1000)}`);
      assert.equal(body.ok, true);
      assert.equal(body.status, "completed");
      assert.ok(Number(body.metrics?.product_image_health_score) >= 0, "complete should return health score metrics");
      assert.ok((body.issue_summary?.total ?? 0) > 0, "complete should return issue summary");
      assert.ok((body.top_recommendations?.length ?? 0) > 0, "complete should return recommendations");
      return body;
    });

    const { value: reportBody } = await time("report", async () => {
      const response = await fetch(`${baseUrl}/api/image-studio/audits/${encodeURIComponent(scanId)}`, {
        headers
      });
      const body = await response.json() as { metrics?: Record<string, unknown>; recommendations?: unknown[]; issue_summary?: { total?: number }; error?: string };
      assert.equal(response.status, 200, `report should load: ${JSON.stringify(body).slice(0, 1000)}`);
      assert.ok(Number(body.metrics?.product_image_health_score) >= 0, "report should include health score metrics");
      assert.ok((body.issue_summary?.total ?? 0) > 0, "report should include issue summary");
      assert.ok((body.recommendations?.length ?? 0) > 0, "report should include recommendations");
      return body;
    });

    const scan = await prisma.imageAuditScan.findUnique({
      where: { id: scanId },
      select: {
        status: true,
        images_scanned: true,
        products_scanned: true
      }
    });
    assert.equal(scan?.status, "completed", "scan row should be completed");
    assert.equal(scan?.images_scanned, itemCount, "scan row should record images scanned");

    console.log(JSON.stringify({
      ok: true,
      scan_id: scanId,
      store_id: site.id,
      items: itemCount,
      complete_ms: completeMs,
      health_score: completeBody.metrics?.product_image_health_score,
      issue_count: completeBody.issue_summary?.total,
      recommendations: completeBody.top_recommendations?.length,
      report_issue_count: reportBody.issue_summary?.total,
      report_recommendations: reportBody.recommendations?.length
    }, null, 2));
  } finally {
    server.close();
    await prisma.$transaction([
      prisma.$executeRaw`DELETE FROM "image_audit_queue_jobs" WHERE "store_id" = ${site.id}`,
      prisma.$executeRaw`DELETE FROM "image_audit_scan_metrics" WHERE "store_id" = ${site.id}`,
      prisma.$executeRaw`DELETE FROM "image_audit_issues" WHERE "store_id" = ${site.id}`,
      prisma.$executeRaw`DELETE FROM "image_audit_insights" WHERE "store_id" = ${site.id}`,
      prisma.$executeRaw`DELETE FROM "image_audit_category_scores" WHERE "store_id" = ${site.id}`,
      prisma.$executeRaw`DELETE FROM "image_audit_recommendations" WHERE "store_id" = ${site.id}`,
      prisma.$executeRaw`DELETE FROM "image_audit_items" WHERE "store_id" = ${site.id}`,
      prisma.$executeRaw`DELETE FROM "image_audit_scans" WHERE "store_id" = ${site.id}`
    ]).catch(() => undefined);
    await prisma.connectedSite.deleteMany({
      where: { id: site.id }
    }).catch(() => undefined);
    await prisma.user.deleteMany({
      where: { id: user.id }
    }).catch(() => undefined);
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
