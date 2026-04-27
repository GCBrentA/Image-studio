import { query } from "../db/pool";
import { addJobEvent } from "./repositories";
import { adminGraphql } from "./shopify";
import type { ShopRecord } from "./session";

export async function createJobsFromProducts(shop: ShopRecord, productCacheIds: string[]) {
  const products = await query(
    `select * from shopify_products_cache where shop_id = $1 and id = any($2::uuid[]) and main_image_url is not null`,
    [shop.id, productCacheIds]
  );
  for (const product of products.rows) {
    const result = await query(
      `insert into image_jobs (shop_id, shopify_product_id, shopify_media_id, source_image_url, status, created_at, updated_at)
       values ($1,$2,$3,$4,'queued',now(),now())
       returning id`,
      [shop.id, product.shopify_product_id, product.main_media_id, product.main_image_url]
    );
    await addJobEvent(String(result.rows[0].id), "queued", { productId: product.shopify_product_id });
  }
  return { queued: products.rows.length };
}

export async function listJobs(shopId: string) {
  const result = await query(
    `select id, shopify_product_id as "shopifyProductId", shopify_media_id as "shopifyMediaId", source_image_url as "sourceImageUrl",
            generated_image_url as "generatedImageUrl", status, error_message as "errorMessage", prompt, mode
     from image_jobs where shop_id = $1 order by updated_at desc limit 250`,
    [shopId]
  );
  return result.rows;
}

export async function generateJob(jobId: string, shop: ShopRecord, regenerate = false) {
  const jobResult = await query("select * from image_jobs where id = $1 and shop_id = $2", [jobId, shop.id]);
  const job = jobResult.rows[0];
  if (!job) throw new Error("Job not found");
  if (!regenerate && job.generated_image_url) return job;

  await query("update image_jobs set status='queued', error_message=null, updated_at=now() where id=$1", [jobId]);
  await addJobEvent(jobId, regenerate ? "regenerate_requested" : "generate_requested");
  return { queued: true };
}

export async function approveJob(jobId: string, shop: ShopRecord) {
  const result = await query(
    "update image_jobs set status='approved', updated_at=now() where id=$1 and shop_id=$2 and generated_image_url is not null returning *",
    [jobId, shop.id]
  );
  if (!result.rows[0]) throw new Error("Generated image required before approval");
  await addJobEvent(jobId, "approved");
  return result.rows[0];
}

export async function rejectJob(jobId: string, shop: ShopRecord) {
  const result = await query("update image_jobs set status='rejected', updated_at=now() where id=$1 and shop_id=$2 returning *", [jobId, shop.id]);
  if (!result.rows[0]) throw new Error("Job not found");
  await addJobEvent(jobId, "rejected");
  return result.rows[0];
}

export async function publishJob(jobId: string, shop: ShopRecord, mode: "replace_main" | "add_extra") {
  const result = await query("select * from image_jobs where id=$1 and shop_id=$2", [jobId, shop.id]);
  const job = result.rows[0];
  if (!job) throw new Error("Job not found");
  if (job.status !== "approved") throw new Error("Merchant approval is required before publishing");
  if (!job.generated_image_url) throw new Error("Generated image URL missing");

  const mutation = `mutation ProductCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media { id status }
      mediaUserErrors { field message }
    }
  }`;
  const data = await adminGraphql<any>(shop.shop_domain, shop.access_token_encrypted, mutation, {
    productId: job.shopify_product_id,
    media: [{ originalSource: job.generated_image_url, mediaContentType: "IMAGE" }]
  });
  const errors = data.productCreateMedia?.mediaUserErrors || [];
  if (errors.length) throw new Error(errors.map((e: any) => e.message).join("; "));

  const mediaId = data.productCreateMedia.media?.[0]?.id || null;
  if (mode === "replace_main" && mediaId) {
    await adminGraphql<any>(
      shop.shop_domain,
      shop.access_token_encrypted,
      `mutation ProductReorderMedia($id: ID!, $moves: [MoveInput!]!) {
        productReorderMedia(id: $id, moves: $moves) {
          job { id }
          mediaUserErrors { field message }
        }
      }`,
      { id: job.shopify_product_id, moves: [{ id: mediaId, newPosition: "0" }] }
    );
  }
  await query(
    "update image_jobs set status='published', shopify_media_id=coalesce($2, shopify_media_id), updated_at=now() where id=$1",
    [jobId, mediaId]
  );
  await addJobEvent(jobId, "published", { mode, mediaId });
  return { mediaId, mode };
}
