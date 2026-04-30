import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import { AddressInfo } from "node:net";
import { app } from "../src/app";

const appJs = readFileSync("public/site/assets/app.js", "utf8");
const styles = readFileSync("public/site/assets/styles.css", "utf8");
const appTs = readFileSync("src/app.ts", "utf8");

assert.doesNotMatch(appJs, /raw\.replace\(\s*\/\^http/, "attention image URLs must not be rewritten from http to https");
assert.match(appJs, /const primaryUrl = proxyUrl \|\| imageUrl/, "attention images should use the proxy URL first");
assert.match(appJs, /data-direct-src/, "attention images should retain the direct image URL fallback");
assert.match(appJs, /<img data-attention-image hidden/, "attention image tags should stay hidden until a real load event");
assert.match(appJs, /img\.hidden = false/, "loaded attention images should be explicitly revealed");
assert.match(appJs, /img\.hidden = true/, "failed attention images should be hidden so no broken icon is shown");
assert.match(styles, /\.attention-card img\[hidden\]/, "hidden attention images should be display none");
assert.match(appTs, /isLocalImageProxyRequest/, "image proxy should have a local development override for private store hosts");

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lw9Z0wAAAABJRU5ErkJggg==",
  "base64"
);

const imageServer = http.createServer((_request, response) => {
  response.writeHead(200, {
    "content-type": "image/png",
    "content-length": png.byteLength
  });
  response.end(png);
});

const main = async (): Promise<void> => {
  let portalServer: http.Server | null = null;
  try {
    await new Promise<void>((resolve) => imageServer.listen(0, "127.0.0.1", resolve));
    portalServer = await new Promise<http.Server>((resolve) => {
      const server = app.listen(0, "127.0.0.1", () => resolve(server));
    });

    const imageAddress = imageServer.address() as AddressInfo;
    const portalAddress = portalServer.address() as AddressInfo;
    const localImageUrl = `http://127.0.0.1:${imageAddress.port}/product-image.png`;
    const proxyUrl = `http://127.0.0.1:${portalAddress.port}/api/image-proxy?url=${encodeURIComponent(localImageUrl)}`;
    const response = await fetch(proxyUrl);
    const body = Buffer.from(await response.arrayBuffer());

    assert.equal(response.status, 200, "local development image proxy should load local/private store images");
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.equal(body.byteLength, png.byteLength);
  } finally {
    await new Promise<void>((resolve) => imageServer.close(() => resolve()));
    if (portalServer) {
      await new Promise<void>((resolve) => portalServer.close(() => resolve()));
    }
  }

  console.log("Attention image proxy regression guard passed.");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
