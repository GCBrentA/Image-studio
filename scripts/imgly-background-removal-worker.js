#!/usr/bin/env node

const fs = require("node:fs/promises");

const main = async () => {
  const [, , inputPath, outputPath, contentType = "image/jpeg"] = process.argv;

  if (!inputPath || !outputPath) {
    throw new Error("Usage: node scripts/imgly-background-removal-worker.js <input> <output> [contentType]");
  }

  const { removeBackground } = await import("@imgly/background-removal-node");
  const input = await fs.readFile(inputPath);
  const result = await removeBackground(
    new Blob([new Uint8Array(input)], {
      type: contentType
    }),
    {
      model: "medium",
      output: {
        format: "image/png",
        quality: 1
      }
    }
  );

  await fs.writeFile(outputPath, Buffer.from(await result.arrayBuffer()));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
