import sharp from "sharp";

export type ValidationOutcome = "PASS" | "SOFT_FAIL_RETRYABLE" | "HARD_FAIL";

export type ProductProtectionProfile = {
  width: number;
  height: number;
  foregroundCoveragePercent: number;
  bounds: ProductBounds;
  centroid: {
    x: number;
    y: number;
  };
  aspectRatio: number;
  labelRegion: ProductBounds;
  criticalEdgePixels: number;
};

export type ProductProtectionValidation = {
  outcome: ValidationOutcome;
  passed: boolean;
  failReasons: string[];
  retryableReasons: string[];
  metrics: {
    silhouetteIoU: number;
    boundsAspectDriftPercent: number;
    centroidDriftPercent: number;
    sourcePixelChangedPercent: number;
    sourcePixelMeanDelta: number;
    histogramDrift: number;
    labelStrokeRetentionPercent: number;
    horizontalStripeScore: number;
    faintProductSharePercent: number;
    bandingScore: number;
  };
  profile: ProductProtectionProfile;
};

type ProductBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ValidateInput = {
  sourceProductBuffer: Buffer;
  finalProductBuffer: Buffer;
  preserveMode: boolean;
};

const alphaThreshold = 24;

export const validateProtectedProductRegion = async ({
  sourceProductBuffer,
  finalProductBuffer,
  preserveMode
}: ValidateInput): Promise<ProductProtectionValidation> => {
  const source = await readRgba(sourceProductBuffer);
  const finalImage = await readRgba(finalProductBuffer, source.width, source.height);
  const sourceAlpha = extractAlpha(source.data);
  const finalAlpha = extractAlpha(finalImage.data);
  const sourceProfile = buildProductProtectionProfile(source.data, sourceAlpha, source.width, source.height);
  const finalProfile = buildProductProtectionProfile(finalImage.data, finalAlpha, finalImage.width, finalImage.height);

  const silhouetteIoU = getMaskIoU(sourceAlpha, finalAlpha);
  const boundsAspectDriftPercent = getPercentDrift(sourceProfile.aspectRatio, finalProfile.aspectRatio);
  const centroidDriftPercent = getCentroidDriftPercent(sourceProfile, finalProfile);
  const pixelFidelity = compareSourcePixels(source.data, finalImage.data, finalAlpha);
  const histogramDrift = getHistogramDrift(source.data, finalImage.data, finalAlpha);
  const labelStrokeRetentionPercent = getLabelStrokeRetentionPercent(source.data, finalImage.data, sourceAlpha, finalAlpha, sourceProfile.labelRegion, source.width, source.height);
  const artifactMetrics = detectProductArtifacts(finalImage.data, finalAlpha, finalImage.width, finalImage.height, finalProfile.bounds);
  const failReasons: string[] = [];
  const retryableReasons: string[] = [];

  if (silhouetteIoU < (preserveMode ? 0.94 : 0.82)) {
    failReasons.push("Product silhouette changed beyond tolerance");
  }
  if (boundsAspectDriftPercent > (preserveMode ? 4 : 12)) {
    failReasons.push("Product geometry/aspect ratio drift exceeded tolerance");
  }
  if (centroidDriftPercent > (preserveMode ? 3 : 8)) {
    retryableReasons.push("Product placement drift exceeded target");
  }
  if (preserveMode && (pixelFidelity.changedPercent > 0.8 || pixelFidelity.meanDelta > 1.5)) {
    failReasons.push("Preserve mode product pixels changed");
  }
  if (!preserveMode && (pixelFidelity.changedPercent > 16 || pixelFidelity.meanDelta > 18 || histogramDrift > 22)) {
    retryableReasons.push("Flexible output changed product appearance too much");
  }
  if (labelStrokeRetentionPercent < (preserveMode ? 92 : 78)) {
    failReasons.push("Label/text/branding detail was lost or degraded");
  }
  if (artifactMetrics.horizontalStripeScore >= 0.35) {
    failReasons.push("Horizontal stripe/scanline corruption detected");
  }
  if (artifactMetrics.faintProductSharePercent > 92) {
    failReasons.push("Product layer is too faint or washed out");
  }
  if (artifactMetrics.bandingScore >= 0.42 && (histogramDrift > 8 || pixelFidelity.meanDelta > 8)) {
    retryableReasons.push("Posterization or banding risk detected");
  }

  const outcome: ValidationOutcome = failReasons.length > 0
    ? "HARD_FAIL"
    : retryableReasons.length > 0
      ? "SOFT_FAIL_RETRYABLE"
      : "PASS";

  return {
    outcome,
    passed: outcome === "PASS",
    failReasons,
    retryableReasons,
    metrics: {
      silhouetteIoU: roundMetric(silhouetteIoU),
      boundsAspectDriftPercent: roundMetric(boundsAspectDriftPercent),
      centroidDriftPercent: roundMetric(centroidDriftPercent),
      sourcePixelChangedPercent: roundMetric(pixelFidelity.changedPercent),
      sourcePixelMeanDelta: roundMetric(pixelFidelity.meanDelta),
      histogramDrift: roundMetric(histogramDrift),
      labelStrokeRetentionPercent: roundMetric(labelStrokeRetentionPercent),
      horizontalStripeScore: roundMetric(artifactMetrics.horizontalStripeScore),
      faintProductSharePercent: roundMetric(artifactMetrics.faintProductSharePercent),
      bandingScore: roundMetric(artifactMetrics.bandingScore)
    },
    profile: finalProfile
  };
};

export const buildProductProtectionProfile = (
  rgba: Buffer,
  alpha: Buffer,
  width: number,
  height: number
): ProductProtectionProfile => {
  const bounds = getAlphaBounds(alpha, width, height) ?? { x: 0, y: 0, width, height };
  let foreground = 0;
  let sumX = 0;
  let sumY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if ((alpha[pixel] ?? 0) < alphaThreshold) continue;
      foreground += 1;
      sumX += x;
      sumY += y;
    }
  }

  const labelRegion = estimateLabelRegion(rgba, alpha, width, height, bounds);

  return {
    width,
    height,
    foregroundCoveragePercent: (foreground / Math.max(1, width * height)) * 100,
    bounds,
    centroid: {
      x: foreground > 0 ? sumX / foreground : bounds.x + bounds.width / 2,
      y: foreground > 0 ? sumY / foreground : bounds.y + bounds.height / 2
    },
    aspectRatio: bounds.width / Math.max(1, bounds.height),
    labelRegion,
    criticalEdgePixels: countCriticalEdgePixels(rgba, alpha, width, height)
  };
};

export const buildProductDiffHeatmap = async (
  sourceProductBuffer: Buffer,
  finalProductBuffer: Buffer
): Promise<Buffer> => {
  const source = await readRgba(sourceProductBuffer);
  const finalImage = await readRgba(finalProductBuffer, source.width, source.height);
  const finalAlpha = extractAlpha(finalImage.data);
  const heatmap = Buffer.alloc(source.width * source.height * 4);

  for (let pixel = 0; pixel < finalAlpha.length; pixel += 1) {
    const index = pixel * 4;
    const delta =
      Math.abs((source.data[index] ?? 0) - (finalImage.data[index] ?? 0)) +
      Math.abs((source.data[index + 1] ?? 0) - (finalImage.data[index + 1] ?? 0)) +
      Math.abs((source.data[index + 2] ?? 0) - (finalImage.data[index + 2] ?? 0));
    const intensity = Math.min(255, Math.round(delta / 3));
    heatmap[index] = 255;
    heatmap[index + 1] = Math.max(0, 120 - intensity);
    heatmap[index + 2] = 0;
    heatmap[index + 3] = (finalAlpha[pixel] ?? 0) >= alphaThreshold && intensity > 2
      ? Math.max(64, intensity)
      : 0;
  }

  return sharp(heatmap, {
    raw: {
      width: source.width,
      height: source.height,
      channels: 4
    }
  })
    .png()
    .toBuffer();
};

const readRgba = async (
  imageBuffer: Buffer,
  width?: number,
  height?: number
): Promise<{ data: Buffer; width: number; height: number }> => {
  const image = sharp(imageBuffer).ensureAlpha();
  const metadata = await image.metadata();
  const targetWidth = width ?? metadata.width;
  const targetHeight = height ?? metadata.height;

  if (!targetWidth || !targetHeight) {
    throw new Error("Product protection validation could not read image dimensions.");
  }

  const pipeline = width && height
    ? image.resize(width, height, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
    : image;
  const data = await pipeline.raw().toBuffer();

  return { data, width: targetWidth, height: targetHeight };
};

const extractAlpha = (rgba: Buffer): Buffer => {
  const alpha = Buffer.alloc(Math.floor(rgba.length / 4));
  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    alpha[pixel] = rgba[pixel * 4 + 3] ?? 0;
  }
  return alpha;
};

const getAlphaBounds = (alpha: Buffer, width: number, height: number): ProductBounds | null => {
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((alpha[y * width + x] ?? 0) < alphaThreshold) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  return maxX >= minX && maxY >= minY
    ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    : null;
};

const getMaskIoU = (a: Buffer, b: Buffer): number => {
  let intersection = 0;
  let union = 0;
  const length = Math.min(a.length, b.length);

  for (let pixel = 0; pixel < length; pixel += 1) {
    const aa = (a[pixel] ?? 0) >= alphaThreshold;
    const bb = (b[pixel] ?? 0) >= alphaThreshold;
    if (aa && bb) intersection += 1;
    if (aa || bb) union += 1;
  }

  return union > 0 ? intersection / union : 0;
};

const compareSourcePixels = (sourceRgba: Buffer, finalRgba: Buffer, alpha: Buffer) => {
  let checked = 0;
  let changed = 0;
  let totalDelta = 0;

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    if ((alpha[pixel] ?? 0) < alphaThreshold) continue;
    const index = pixel * 4;
    const delta =
      Math.abs((sourceRgba[index] ?? 0) - (finalRgba[index] ?? 0)) +
      Math.abs((sourceRgba[index + 1] ?? 0) - (finalRgba[index + 1] ?? 0)) +
      Math.abs((sourceRgba[index + 2] ?? 0) - (finalRgba[index + 2] ?? 0));
    checked += 1;
    totalDelta += delta / 3;
    if (delta > 18) changed += 1;
  }

  return {
    changedPercent: checked > 0 ? (changed / checked) * 100 : 100,
    meanDelta: checked > 0 ? totalDelta / checked : 255
  };
};

const getHistogramDrift = (sourceRgba: Buffer, finalRgba: Buffer, alpha: Buffer): number => {
  const sourceHist = new Array<number>(16).fill(0);
  const finalHist = new Array<number>(16).fill(0);
  let count = 0;

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    if ((alpha[pixel] ?? 0) < alphaThreshold) continue;
    const index = pixel * 4;
    sourceHist[Math.min(15, Math.floor(getLuminance(sourceRgba, index) / 16))] += 1;
    finalHist[Math.min(15, Math.floor(getLuminance(finalRgba, index) / 16))] += 1;
    count += 1;
  }

  if (count === 0) return 100;

  let drift = 0;
  for (let index = 0; index < sourceHist.length; index += 1) {
    drift += Math.abs((sourceHist[index] ?? 0) - (finalHist[index] ?? 0)) / count;
  }

  return drift * 100;
};

const getLabelStrokeRetentionPercent = (
  sourceRgba: Buffer,
  finalRgba: Buffer,
  sourceAlpha: Buffer,
  finalAlpha: Buffer,
  region: ProductBounds,
  width: number,
  height: number
): number => {
  let sourceStroke = 0;
  let retainedStroke = 0;

  for (let y = region.y; y < Math.min(height - 1, region.y + region.height); y += 1) {
    for (let x = region.x; x < Math.min(width - 1, region.x + region.width); x += 1) {
      const pixel = y * width + x;
      if ((sourceAlpha[pixel] ?? 0) < alphaThreshold) continue;
      const sourceGradient = getGradient(sourceRgba, width, height, pixel);
      if (sourceGradient < 20) continue;
      sourceStroke += 1;
      if ((finalAlpha[pixel] ?? 0) >= alphaThreshold && getGradient(finalRgba, width, height, pixel) >= 12) {
        retainedStroke += 1;
      }
    }
  }

  return sourceStroke > 0 ? (retainedStroke / sourceStroke) * 100 : 100;
};

const detectProductArtifacts = (
  rgba: Buffer,
  alpha: Buffer,
  width: number,
  height: number,
  bounds: ProductBounds
) => {
  let strongHorizontalRows = 0;
  let isolatedStrongHorizontalRows = 0;
  let faintPixels = 0;
  let foregroundPixels = 0;
  const rowStrength: number[] = [];

  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    let rowStrong = 0;
    let rowForeground = 0;
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      const pixel = y * width + x;
      if ((alpha[pixel] ?? 0) < alphaThreshold) continue;
      const index = pixel * 4;
      const luminance = getLuminance(rgba, index);
      const saturation = getSaturation(rgba[index] ?? 0, rgba[index + 1] ?? 0, rgba[index + 2] ?? 0);
      const gradient = getGradient(rgba, width, height, pixel);
      rowForeground += 1;
      foregroundPixels += 1;
      if (luminance > 232 && saturation < 0.08 && gradient < 8) faintPixels += 1;
      if (luminance < 190 || saturation > 0.22) rowStrong += 1;
    }
    const strength = rowStrong / Math.max(1, rowForeground);
    rowStrength.push(strength);
    if (strength > 0.24 && rowForeground / Math.max(1, bounds.width) > 0.2) {
      strongHorizontalRows += 1;
    }
  }

  for (let index = 1; index < rowStrength.length - 1; index += 1) {
    if ((rowStrength[index] ?? 0) > 0.24 && (rowStrength[index - 1] ?? 0) < 0.08 && (rowStrength[index + 1] ?? 0) < 0.08) {
      isolatedStrongHorizontalRows += 1;
    }
  }

  const stripeDensity = strongHorizontalRows / Math.max(1, bounds.height);
  const stripeIsolation = isolatedStrongHorizontalRows / Math.max(1, strongHorizontalRows);
  const horizontalStripeScore = bounds.width / Math.max(1, bounds.height) > 2.4
    ? Math.min(1, stripeDensity * 2 + stripeIsolation * 0.7)
    : Math.min(1, stripeDensity * 0.5 + stripeIsolation * 0.2);

  return {
    horizontalStripeScore,
    faintProductSharePercent: foregroundPixels > 0 ? (faintPixels / foregroundPixels) * 100 : 100,
    bandingScore: getBandingScore(rgba, alpha)
  };
};

const estimateLabelRegion = (
  rgba: Buffer,
  alpha: Buffer,
  width: number,
  height: number,
  bounds: ProductBounds
): ProductBounds => {
  let best: ProductBounds = {
    x: bounds.x + Math.round(bounds.width * 0.2),
    y: bounds.y + Math.round(bounds.height * 0.25),
    width: Math.max(1, Math.round(bounds.width * 0.6)),
    height: Math.max(1, Math.round(bounds.height * 0.5))
  };
  let bestScore = 0;
  const windowWidth = Math.max(12, Math.round(bounds.width * 0.45));
  const windowHeight = Math.max(12, Math.round(bounds.height * 0.36));
  const stepX = Math.max(4, Math.round(windowWidth / 4));
  const stepY = Math.max(4, Math.round(windowHeight / 4));

  for (let y = bounds.y; y <= bounds.y + bounds.height - windowHeight; y += stepY) {
    for (let x = bounds.x; x <= bounds.x + bounds.width - windowWidth; x += stepX) {
      let score = 0;
      for (let yy = y; yy < y + windowHeight; yy += 2) {
        for (let xx = x; xx < x + windowWidth; xx += 2) {
          const pixel = yy * width + xx;
          if ((alpha[pixel] ?? 0) < alphaThreshold) continue;
          score += getGradient(rgba, width, height, pixel) > 18 ? 1 : 0;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = { x, y, width: windowWidth, height: windowHeight };
      }
    }
  }

  return {
    x: Math.max(0, Math.min(width - 1, best.x)),
    y: Math.max(0, Math.min(height - 1, best.y)),
    width: Math.max(1, Math.min(width - best.x, best.width)),
    height: Math.max(1, Math.min(height - best.y, best.height))
  };
};

const countCriticalEdgePixels = (rgba: Buffer, alpha: Buffer, width: number, height: number): number => {
  let count = 0;
  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    if ((alpha[pixel] ?? 0) < alphaThreshold) continue;
    if (hasTransparentNeighbor(alpha, width, height, pixel) && getGradient(rgba, width, height, pixel) > 16) {
      count += 1;
    }
  }
  return count;
};

const hasTransparentNeighbor = (alpha: Buffer, width: number, height: number, pixel: number): boolean => {
  const x = pixel % width;
  const y = Math.floor(pixel / width);
  return [
    x > 0 ? pixel - 1 : -1,
    x < width - 1 ? pixel + 1 : -1,
    y > 0 ? pixel - width : -1,
    y < height - 1 ? pixel + width : -1
  ].some((next) => next >= 0 && (alpha[next] ?? 0) < alphaThreshold);
};

const getGradient = (rgba: Buffer, width: number, height: number, pixel: number): number => {
  const x = pixel % width;
  const y = Math.floor(pixel / width);
  const left = (y * width + Math.max(0, x - 1)) * 4;
  const right = (y * width + Math.min(width - 1, x + 1)) * 4;
  const up = (Math.max(0, y - 1) * width + x) * 4;
  const down = (Math.min(height - 1, y + 1) * width + x) * 4;
  return (
    Math.abs(getLuminance(rgba, left) - getLuminance(rgba, right)) +
    Math.abs(getLuminance(rgba, up) - getLuminance(rgba, down))
  ) / 2;
};

const getBandingScore = (rgba: Buffer, alpha: Buffer): number => {
  const bins = new Set<number>();
  let checked = 0;
  for (let pixel = 0; pixel < alpha.length; pixel += 8) {
    if ((alpha[pixel] ?? 0) < alphaThreshold) continue;
    bins.add(Math.round(getLuminance(rgba, pixel * 4) / 8));
    checked += 1;
  }
  if (checked < 100) return 0;
  return Math.max(0, 1 - bins.size / 28);
};

const getLuminance = (rgba: Buffer, index: number): number =>
  0.2126 * (rgba[index] ?? 0) + 0.7152 * (rgba[index + 1] ?? 0) + 0.0722 * (rgba[index + 2] ?? 0);

const getSaturation = (r: number, g: number, b: number): number => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
};

const getPercentDrift = (a: number, b: number): number =>
  Math.abs(a - b) / Math.max(0.001, Math.abs(a)) * 100;

const getCentroidDriftPercent = (a: ProductProtectionProfile, b: ProductProtectionProfile): number => {
  const dx = a.centroid.x - b.centroid.x;
  const dy = a.centroid.y - b.centroid.y;
  const diagonal = Math.sqrt(a.width * a.width + a.height * a.height);
  return (Math.sqrt(dx * dx + dy * dy) / Math.max(1, diagonal)) * 100;
};

const roundMetric = (value: number): number =>
  Number(value.toFixed(4));
