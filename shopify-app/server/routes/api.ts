import { Router } from "express";
import { query } from "../db/pool";
import { requireShopSession, type AuthedRequest } from "../services/session";
import { createJobsFromProducts, generateJob, listJobs, publishJob, approveJob, rejectJob } from "../services/jobs";
import { listProducts, scanProducts } from "../services/products";
import { getSettings, updateSettings } from "../services/settings";

export const apiRouter = Router();
apiRouter.use(requireShopSession);

apiRouter.get("/dashboard", async (req: AuthedRequest, res, next) => {
  try {
    const shop = req.shopRecord!;
    const result = await query(
      `select
        (select count(*)::int from shopify_products_cache where shop_id=$1) as "productsScanned",
        (select count(*)::int from image_jobs where shop_id=$1 and status='queued') as "imagesQueued",
        (select count(*)::int from image_jobs where shop_id=$1 and status in ('completed','approved','published')) as "imagesProcessed",
        (select count(*)::int from image_jobs where shop_id=$1 and status='completed') as "pendingReview"`,
      [shop.id]
    );
    res.json({ ...result.rows[0], creditsRemaining: shop.credits_remaining });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/products/scan", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await scanProducts(req.shopRecord!, String(req.body.status || "ACTIVE")));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/products", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await listProducts(req.shopRecord!.id, {
      status: String(req.query.status || "ACTIVE"),
      imageState: String(req.query.imageState || "present")
    }));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/jobs", async (req: AuthedRequest, res, next) => {
  try {
    const ids = Array.isArray(req.body.productCacheIds) ? req.body.productCacheIds.map(String) : [];
    res.json(await createJobsFromProducts(req.shopRecord!, ids));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/jobs", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await listJobs(req.shopRecord!.id));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/jobs/:id/generate", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await generateJob(String(req.params.id), req.shopRecord!, Boolean(req.body.regenerate)));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/jobs/:id/approve", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await approveJob(String(req.params.id), req.shopRecord!));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/jobs/:id/reject", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await rejectJob(String(req.params.id), req.shopRecord!));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/jobs/:id/publish", async (req: AuthedRequest, res, next) => {
  try {
    const mode = req.body.mode === "replace_main" ? "replace_main" : "add_extra";
    res.json(await publishJob(String(req.params.id), req.shopRecord!, mode));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/settings", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await getSettings(req.shopRecord!.id));
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/settings", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await updateSettings(req.shopRecord!.id, req.body));
  } catch (error) {
    next(error);
  }
});
