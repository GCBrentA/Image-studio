import { Badge, Banner, Button, Card, IndexTable, Page, Thumbnail } from "@shopify/polaris";
import { useEffect, useState } from "react";
import { api, ImageJob } from "../api";

export function Queue() {
  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setJobs(await api<ImageJob[]>("/jobs"));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function action(id: string, actionName: string, body: Record<string, unknown> = {}) {
    setBusy(`${id}:${actionName}`);
    setError(null);
    try {
      await api(`/jobs/${id}/${actionName}`, { method: "POST", body: JSON.stringify(body) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page title="Image Queue" subtitle="Generate, review, approve, reject, and publish images.">
      {error ? <Banner tone="critical">{error}</Banner> : null}
      <Card>
        <IndexTable
          resourceName={{ singular: "job", plural: "jobs" }}
          itemCount={jobs.length}
          selectable={false}
          headings={[
            { title: "Original" },
            { title: "Generated" },
            { title: "Status" },
            { title: "Actions" },
            { title: "Error" }
          ]}
        >
          {jobs.map((job, index) => (
            <IndexTable.Row id={job.id} key={job.id} position={index}>
              <IndexTable.Cell><Thumbnail source={job.sourceImageUrl} alt="Original product image" /></IndexTable.Cell>
              <IndexTable.Cell>{job.generatedImageUrl ? <Thumbnail source={job.generatedImageUrl} alt="Generated product image" /> : "Not generated"}</IndexTable.Cell>
              <IndexTable.Cell><Badge tone={tone(job.status)}>{job.status}</Badge></IndexTable.Cell>
              <IndexTable.Cell>
                <div className="optivra-actions">
                  <Button size="slim" loading={busy === `${job.id}:generate`} onClick={() => action(job.id, "generate")}>Generate</Button>
                  <Button size="slim" loading={busy === `${job.id}:generate`} onClick={() => action(job.id, "generate", { regenerate: true })}>Regenerate</Button>
                  <Button size="slim" onClick={() => action(job.id, "approve")}>Approve</Button>
                  <Button size="slim" onClick={() => action(job.id, "reject")}>Reject</Button>
                  <Button size="slim" onClick={() => action(job.id, "publish", { mode: "replace_main" })}>Replace main image</Button>
                  <Button size="slim" onClick={() => action(job.id, "publish", { mode: "add_extra" })}>Add as extra image</Button>
                </div>
              </IndexTable.Cell>
              <IndexTable.Cell>{job.errorMessage || ""}</IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </Card>
    </Page>
  );
}

function tone(status: string) {
  if (status === "completed" || status === "approved" || status === "published") return "success";
  if (status === "failed" || status === "rejected") return "critical";
  if (status === "processing") return "attention";
  return "info";
}
