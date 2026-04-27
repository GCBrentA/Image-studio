import { Banner, Button, Card, InlineGrid, Page, Text } from "@shopify/polaris";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, DashboardSummary } from "../api";

export function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<DashboardSummary>("/dashboard").then(setSummary).catch((err) => setError(err.message));
  }, []);

  return (
    <Page
      title="Optivra Image Studio"
      subtitle="Scan products, generate improved images, review results, and publish back to Shopify."
      primaryAction={<Button url="/products" variant="primary">Scan Products</Button>}
    >
      {error ? <Banner tone="critical">{error}</Banner> : null}
      <InlineGrid columns={{ xs: 1, md: 5 }} gap="400">
        <Metric title="Products scanned" value={summary?.productsScanned ?? 0} />
        <Metric title="Images queued" value={summary?.imagesQueued ?? 0} />
        <Metric title="Images processed" value={summary?.imagesProcessed ?? 0} />
        <Metric title="Pending review" value={summary?.pendingReview ?? 0} />
        <Metric title="Credits remaining" value={summary?.creditsRemaining ?? 0} />
      </InlineGrid>
      <div style={{ marginTop: 24 }}>
        <Card>
          <Text as="h2" variant="headingMd">Workflow</Text>
          <p>Scan products → Queue images → Generate → Review → Publish.</p>
          <div className="optivra-actions">
            <Button url="/products">Open Products</Button>
            <Button url="/queue">Open Queue</Button>
            <Button url="/settings">Settings</Button>
          </div>
        </Card>
      </div>
    </Page>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <Text as="p" tone="subdued">{title}</Text>
      <Text as="p" variant="headingLg">{value}</Text>
    </Card>
  );
}
