import "dotenv/config";
import { pool, query } from "../db/pool";
import { generateImage } from "../services/optivra";
import { addJobEvent } from "../services/repositories";
import { getSettings } from "../services/settings";

const pollMs = Number(process.env.WORKER_POLL_MS || 10000);

async function processOne() {
  const result = await query(
    `select j.*, s.uninstalled_at
     from image_jobs j
     join shops s on s.id = j.shop_id
     where j.status = 'queued' and s.uninstalled_at is null
     order by j.created_at asc
     limit 1`
  );
  const job = result.rows[0];
  if (!job) return;

  const jobId = String(job.id);
  const shopId = String(job.shop_id);
  await query("update image_jobs set status='processing', updated_at=now() where id=$1", [jobId]);
  await addJobEvent(jobId, "processing_started");

  try {
    const settings = await getSettings(shopId);
    const generated = await generateImage({
      sourceImageUrl: String(job.source_image_url),
      prompt: job.prompt ? String(job.prompt) : String(settings?.defaultPrompt || ""),
      mode: job.mode ? String(job.mode) : String(settings?.backgroundMode || "pure_white"),
      settings
    });
    await query(
      "update image_jobs set status='completed', generated_image_url=$2, error_message=null, updated_at=now() where id=$1",
      [jobId, generated.generatedImageUrl]
    );
    await query("update shops set credits_remaining = greatest(credits_remaining - 1, 0), updated_at=now() where id=$1", [shopId]);
    await query("insert into credit_events (shop_id, image_job_id, amount, reason) values ($1,$2,$3,$4)", [shopId, jobId, -1, "image_generation"]);
    await addJobEvent(jobId, "processing_completed", generated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";
    await query("update image_jobs set status='failed', error_message=$2, updated_at=now() where id=$1", [jobId, message]);
    await addJobEvent(jobId, "processing_failed", { message });
  }
}

async function loop() {
  try {
    await processOne();
  } catch (error) {
    console.error(error);
  } finally {
    setTimeout(loop, pollMs);
  }
}

console.info("Optivra Image Studio worker started");
loop();

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});
