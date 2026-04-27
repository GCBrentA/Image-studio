import { query } from "../db/pool";
import { adminGraphql } from "./shopify";
import type { ShopRecord } from "./session";

type ShopifyProductsResponse = {
  products: {
    nodes: Array<{
      id: string;
      title: string;
      handle: string;
      status: string;
      featuredMedia?: { id: string; preview?: { image?: { url: string } } } | null;
      media: { nodes: Array<{ id: string; preview?: { image?: { url: string } } }> };
    }>;
  };
};

export async function scanProducts(shop: ShopRecord, status: string) {
  const queryText = status && status !== "ANY" ? `status:${status}` : "";
  const data = await adminGraphql<ShopifyProductsResponse>(
    shop.shop_domain,
    shop.access_token_encrypted,
    `query Products($query: String) {
      products(first: 100, query: $query) {
        nodes {
          id
          title
          handle
          status
          featuredMedia { id preview { image { url } } }
          media(first: 20) { nodes { id preview { image { url } } } }
        }
      }
    }`,
    { query: queryText }
  );

  for (const product of data.products.nodes) {
    const mainImageUrl = product.featuredMedia?.preview?.image?.url || product.media.nodes[0]?.preview?.image?.url || null;
    const mainMediaId = product.featuredMedia?.id || product.media.nodes[0]?.id || null;
    await query(
      `insert into shopify_products_cache (shop_id, shopify_product_id, title, handle, status, image_count, main_image_url, main_media_id, last_synced_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())
       on conflict (shop_id, shopify_product_id)
       do update set title=$3, handle=$4, status=$5, image_count=$6, main_image_url=$7, main_media_id=$8, last_synced_at=now(), updated_at=now()`,
      [shop.id, product.id, product.title, product.handle, product.status, product.media.nodes.length, mainImageUrl, mainMediaId]
    );
  }

  return { scanned: data.products.nodes.length };
}

export async function listProducts(shopId: string, filters: { status?: string; imageState?: string }) {
  const clauses = ["shop_id = $1"];
  const values: unknown[] = [shopId];
  if (filters.status && filters.status !== "ANY") {
    values.push(filters.status);
    clauses.push(`status = $${values.length}`);
  }
  if (filters.imageState === "present") clauses.push("image_count > 0");
  if (filters.imageState === "missing") clauses.push("image_count = 0");

  const result = await query(
    `select id, shopify_product_id as "shopifyProductId", title, status, image_count as "imageCount", main_image_url as "mainImageUrl", main_media_id as "mainMediaId"
     from shopify_products_cache
     where ${clauses.join(" and ")}
     order by updated_at desc
     limit 250`,
    values
  );
  return result.rows;
}
