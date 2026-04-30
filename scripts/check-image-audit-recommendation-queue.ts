import assert from "node:assert/strict";
import { app } from "../src/app";
import { generateApiToken, hashApiToken } from "../src/utils/apiToken";
import { prisma } from "../src/utils/prisma";

type QueueResponse = {
  ok?: boolean;
  success?: boolean;
  status?: string;
  createdCount?: number;
  skippedDuplicateCount?: number;
  jobKind?: string;
  job_kind?: string;
  actionType?: string;
  action_type?: string;
  queueItems?: Array<Record<string, unknown>>;
  queue_jobs?: Array<Record<string, unknown>>;
  message?: string;
  error?: unknown;
};

const main = async (): Promise<void> => {
  const token = generateApiToken();
  const email = `image-audit-queue-${Date.now()}@example.test`;
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
      domain: "queue.localhost",
      canonical_domain: "queue.localhost",
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
    "X-Optivra-Site-Url": "http://queue.localhost",
    "X-Optivra-Home-Url": "http://queue.localhost",
    "X-Optivra-WordPress-Install-Id": `queue-e2e-${Date.now()}`,
    "X-Optivra-Plugin-Version": "test"
  };

  try {
    const start = await fetch(`${baseUrl}/api/image-studio/audits/start`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: "woocommerce",
        scan_options: {
          total_products_estimate: 6
        }
      })
    });
    const startBody = await start.json() as { scan_id?: string; error?: unknown };
    assert.equal(start.status, 201, `Audit start should succeed: ${JSON.stringify(startBody)}`);
    assert.ok(startBody.scan_id, "Audit start should return scan_id");

    const items = await fetch(`${baseUrl}/api/image-studio/audits/${encodeURIComponent(startBody.scan_id)}/items`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        items: Array.from({ length: 6 }, (_, index) => ({
          product_id: `queue-product-${index}`,
          product_name: `Queue Test Product ${index}`,
          product_url: `http://queue.localhost/product/queue-test-product-${index}`,
          image_id: `queue-image-${index}`,
          image_url: `http://queue.localhost/wp-content/uploads/queue-test-product-${index}.jpg`,
          image_role: "main",
          category_ids: ["queue-category"],
          category_names: ["Queue QA"],
          filename: `queue-test-product-${index}.jpg`,
          mime_type: "image/jpeg",
          width: 2600,
          height: 2600,
          file_size_bytes: 3 * 1024 * 1024,
          alt_text: ""
        }))
      })
    });
    const itemsBody = await items.json() as { inserted?: number; error?: unknown };
    assert.equal(items.status, 201, `Audit items should be accepted: ${JSON.stringify(itemsBody)}`);
    assert.equal(itemsBody.inserted, 6, "Audit should insert all queue test rows");

    const complete = await fetch(`${baseUrl}/api/image-studio/audits/${encodeURIComponent(startBody.scan_id)}/complete`, {
      method: "POST",
      headers,
      body: JSON.stringify({})
    });
    const completeBody = await complete.json() as { ok?: boolean; error?: unknown };
    assert.equal(complete.status, 200, `Audit complete should succeed: ${JSON.stringify(completeBody)}`);
    assert.equal(completeBody.ok, true, "Audit complete should return ok true");

    const recommendations = await prisma.imageAuditRecommendation.findMany({
      where: {
        scan_id: startBody.scan_id,
        store_id: site.id
      },
      select: {
        id: true,
        title: true,
        action_type: true
      }
    });
    const imageRecommendation = recommendations.find((recommendation) => recommendation.title === "Optimise oversized images");
    const altRecommendation = recommendations.find((recommendation) => recommendation.title === "Fix missing alt text");
    assert.ok(imageRecommendation, `Expected image-processing recommendation, got ${JSON.stringify(recommendations)}`);
    assert.ok(altRecommendation, `Expected alt-text recommendation, got ${JSON.stringify(recommendations)}`);

    const queueImage = async (): Promise<QueueResponse> => {
      const response = await fetch(`${baseUrl}/api/image-studio/queue/recommendation`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          scanId: startBody.scan_id,
          recommendationId: imageRecommendation.id,
          background_preset: "optivra-default"
        })
      });
      const body = await response.json() as QueueResponse;
      assert.equal(response.status, 200, `Image recommendation queue should succeed: ${JSON.stringify(body)}`);
      return body;
    };

    const firstImageQueue = await queueImage();
    assert.equal(firstImageQueue.success, true, "Image recommendation queue should be successful");
    assert.equal(firstImageQueue.jobKind ?? firstImageQueue.job_kind, "image_processing", "Image recommendation must create image-processing jobs");
    assert.equal(firstImageQueue.actionType ?? firstImageQueue.action_type, "optimise_image", "Oversized recommendation should map to optimise_image");
    assert.ok((firstImageQueue.createdCount ?? 0) > 0, "First image queue click should create queue rows");
    assert.ok((firstImageQueue.queueItems ?? firstImageQueue.queue_jobs ?? []).length > 0, "First image queue click should return queue items");

    const secondImageQueue = await queueImage();
    assert.equal(secondImageQueue.success, true, "Duplicate image queue click should not crash");
    assert.equal(secondImageQueue.createdCount ?? 0, 0, "Duplicate image queue click should not create duplicate rows");
    assert.ok((secondImageQueue.skippedDuplicateCount ?? 0) > 0, "Duplicate image queue click should report skipped duplicates");

    const altResponse = await fetch(`${baseUrl}/api/image-studio/audits/${encodeURIComponent(startBody.scan_id)}/queue-recommendation`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        recommendation_id: altRecommendation.id
      })
    });
    const altBody = await altResponse.json() as QueueResponse;
    assert.equal(altResponse.status, 200, `Alt text recommendation queue should succeed: ${JSON.stringify(altBody)}`);
    assert.equal(altBody.success, true, "Alt text recommendation queue should be successful");
    assert.equal(altBody.jobKind ?? altBody.job_kind, "seo_only", "Alt text recommendation must stay out of image-processing jobs");
    assert.equal(altBody.actionType ?? altBody.action_type, "generate_alt_text", "Alt text recommendation should map to generate_alt_text");
    assert.ok((altBody.createdCount ?? 0) > 0, "Alt text recommendation should create SEO-only tasks");

    const imageJobs = await prisma.imageAuditQueueJob.count({
      where: {
        scan_id: startBody.scan_id,
        store_id: site.id,
        job_kind: "image_processing"
      }
    });
    const seoJobs = await prisma.imageAuditQueueJob.count({
      where: {
        scan_id: startBody.scan_id,
        store_id: site.id,
        job_kind: "seo_only"
      }
    });
    assert.equal(imageJobs, firstImageQueue.createdCount, "Only the image-processing recommendation should add image jobs");
    assert.equal(seoJobs, altBody.createdCount, "Alt text recommendation should create SEO-only queue jobs");

    console.log(JSON.stringify({
      ok: true,
      scan_id: startBody.scan_id,
      image_recommendation: imageRecommendation.title,
      image_jobs_created: firstImageQueue.createdCount,
      duplicate_jobs_skipped: secondImageQueue.skippedDuplicateCount,
      alt_text_jobs_created: altBody.createdCount,
      image_job_kind: firstImageQueue.jobKind ?? firstImageQueue.job_kind,
      alt_job_kind: altBody.jobKind ?? altBody.job_kind
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
