import { Banner, Button, Card, IndexTable, Page, Select, Thumbnail } from "@shopify/polaris";
import { useEffect, useState } from "react";
import { api, ProductRow } from "../api";

export function Products() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState("ACTIVE");
  const [imageState, setImageState] = useState("present");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const query = new URLSearchParams({ status, imageState }).toString();
    setProducts(await api<ProductRow[]>(`/products?${query}`));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [status, imageState]);

  async function scan() {
    setLoading(true);
    setError(null);
    try {
      await api("/products/scan", { method: "POST", body: JSON.stringify({ status }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  async function queueSelected(ids = selected) {
    setLoading(true);
    try {
      await api("/jobs", { method: "POST", body: JSON.stringify({ productCacheIds: ids }) });
      setSelected([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Queue failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page title="Products" subtitle="Scan Shopify products and queue selected images.">
      {error ? <Banner tone="critical">{error}</Banner> : null}
      <Card>
        <div className="optivra-actions">
          <Select label="Product status" value={status} onChange={setStatus} options={[
            { label: "Active", value: "ACTIVE" },
            { label: "Draft", value: "DRAFT" },
            { label: "Archived", value: "ARCHIVED" },
            { label: "Any", value: "ANY" }
          ]} />
          <Select label="Images" value={imageState} onChange={setImageState} options={[
            { label: "Images present", value: "present" },
            { label: "Images missing", value: "missing" },
            { label: "All", value: "all" }
          ]} />
          <Button onClick={scan} loading={loading}>Scan products</Button>
          <Button variant="primary" disabled={!selected.length} onClick={() => queueSelected()}>Queue selected images</Button>
          <Button disabled={!products.length} onClick={() => queueSelected(products.map((p) => p.id))}>Queue all visible</Button>
        </div>
      </Card>
      <Card>
        <IndexTable
          resourceName={{ singular: "product", plural: "products" }}
          itemCount={products.length}
          selectedItemsCount={selected.length}
          onSelectionChange={(selection) => setSelected(Array.isArray(selection) ? selection as string[] : [])}
          headings={[
            { title: "Image" },
            { title: "Product" },
            { title: "Status" },
            { title: "Images" }
          ]}
        >
          {products.map((product, index) => (
            <IndexTable.Row id={product.id} key={product.id} position={index} selected={selected.includes(product.id)}>
              <IndexTable.Cell>{product.mainImageUrl ? <Thumbnail source={product.mainImageUrl} alt={product.title} /> : "No image"}</IndexTable.Cell>
              <IndexTable.Cell>{product.title}</IndexTable.Cell>
              <IndexTable.Cell>{product.status}</IndexTable.Cell>
              <IndexTable.Cell>{product.imageCount}</IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </Card>
    </Page>
  );
}
