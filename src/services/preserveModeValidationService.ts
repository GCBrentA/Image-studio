import sharp from "sharp";

export type PreserveModeFailReason =
  | "Edge Halo / Background Residue"
  | "Interior Product Dropout"
  | "Product Pixel Loss"
  | "Mask Includes Background"
  | "Low Confidence Preserve Result"
  | "AI Product Pixel Contamination"
  | "Product Geometry Changed"
  | "Dirty Alpha Edge"
  | "Disconnected Background Artifact";

export type PreserveModeProgrammaticValidation = {
  passed: boolean;
  overallScore: number;
  failReasons: PreserveModeFailReason[];
  scores: {
    productPreservation: number;
    edgeCleanliness: number;
    backgroundResidue: number;
    alphaConfidence: number;
    dropoutScore: number;
    sourcePixelIntegrity: number;
    commercialReadiness: number;
  };
  metrics: Record<string, number | string | boolean | null>;
  overlays: {
    edgeInspectionRing?: Buffer;
    edgeHaloOverlay?: Buffer;
    connectedComponentsOverlay?: Buffer;
    dropoutOverlay?: Buffer;
    alphaMaskPreview?: Buffer;
    checkerboardPreview?: Buffer;
  };
};

type ValidationInput = {
  sourceBuffer: Buffer;
  productCutoutBuffer: Buffer;
  sourceReferenceAlpha?: Buffer;
  referenceWidth?: number;
  referenceHeight?: number;
};

type Bounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
};

const alphaThreshold = 24;

export const validatePreserveModeProgrammatic = async ({
  sourceBuffer,
  productCutoutBuffer,
  sourceReferenceAlpha,
  referenceWidth,
  referenceHeight
}: ValidationInput): Promise<PreserveModeProgrammaticValidation> => {
  const cutout = sharp(productCutoutBuffer).ensureAlpha();
  const metadata = await cutout.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Preserve validation could not read product cutout dimensions.");
  }

  const width = metadata.width;
  const height = metadata.height;
  const [sourceRgba, cutoutRgba] = await Promise.all([
    sharp(sourceBuffer).rotate().resize(width, height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }).ensureAlpha().raw().toBuffer(),
    cutout.raw().toBuffer()
  ]);
  const alpha = extractAlpha(cutoutRgba);
  const bounds = getAlphaBounds(alpha, width, height);
  const failReasons = new Set<PreserveModeFailReason>();
  const foregroundPixels = countAlpha(alpha);
  const semiTransparentPixels = countSemiTransparent(alpha);
  const totalPixels = width * height;
  const components = getConnectedComponents(alpha, width, height);
  const largestComponentPixels = components[0]?.length ?? 0;
  const largestShare = foregroundPixels > 0 ? largestComponentPixels / foregroundPixels : 0;
  const sourceIntegrity = getSourcePixelIntegrity(sourceRgba, cutoutRgba, alpha, width, height);
  const referenceAlpha = sourceReferenceAlpha && referenceWidth === width && referenceHeight === height
    ? sourceReferenceAlpha
    : null;
  const edge = inspectEdgeResidue(sourceRgba, cutoutRgba, alpha, width, height, referenceAlpha);
  const geometry = sourceReferenceAlpha && referenceWidth && referenceHeight
    ? compareReferenceGeometry(alpha, width, height, sourceReferenceAlpha, referenceWidth, referenceHeight)
    : { passed: true, widthRatio: 1, heightRatio: 1, areaRatio: 1 };

  if (!bounds || foregroundPixels < Math.max(500, totalPixels * 0.001)) {
    failReasons.add("Low Confidence Preserve Result");
  }

  if (semiTransparentPixels > Math.max(2400, foregroundPixels * 0.08)) {
    failReasons.add("Dirty Alpha Edge");
  }

  if (components.length > 18 && largestShare < 0.94) {
    failReasons.add("Disconnected Background Artifact");
  }

  if (edge.haloPixels > Math.max(180, edge.insideEdgePixels * 0.035)) {
    failReasons.add("Edge Halo / Background Residue");
  }

  if (edge.backgroundLikeForegroundPixels > Math.max(500, foregroundPixels * 0.045)) {
    failReasons.add("Mask Includes Background");
  }

  if (!sourceIntegrity.passed) {
    failReasons.add("AI Product Pixel Contamination");
  }

  if (!geometry.passed) {
    failReasons.add("Product Pixel Loss");
    failReasons.add("Product Geometry Changed");
  }

  const edgeCleanliness = scoreFromRatio(edge.haloPixels, Math.max(1, edge.insideEdgePixels), 0.08);
  const backgroundResidue = scoreFromRatio(edge.backgroundLikeForegroundPixels, Math.max(1, foregroundPixels), 0.08);
  const alphaConfidence = Math.round(Math.max(0, Math.min(100, largestShare * 100 - Math.min(25, components.length))));
  const sourcePixelIntegrity = Math.round(sourceIntegrity.score);
  const productPreservation = Math.min(sourcePixelIntegrity, geometry.passed ? 100 : Math.round(Math.max(0, geometry.areaRatio * 100)));
  const dropoutScore = geometry.passed ? 100 : Math.round(Math.max(0, geometry.areaRatio * 100));
  const commercialReadiness = Math.min(edgeCleanliness, backgroundResidue, alphaConfidence, productPreservation, dropoutScore);
  const scores = {
    productPreservation,
    edgeCleanliness,
    backgroundResidue,
    alphaConfidence,
    dropoutScore,
    sourcePixelIntegrity,
    commercialReadiness
  };
  const overallScore = Math.round(Object.values(scores).reduce((total, score) => total + score, 0) / Object.values(scores).length);
  const overlays = {
    edgeInspectionRing: await buildRingPreview(alpha, width, height),
    edgeHaloOverlay: await buildHaloOverlay(sourceRgba, edge.haloMask, width, height),
    connectedComponentsOverlay: await buildComponentsOverlay(sourceRgba, components, width, height),
    alphaMaskPreview: await buildAlphaPreview(alpha, width, height),
    checkerboardPreview: await buildCheckerboardPreview(cutoutRgba, width, height)
  };

  return {
    passed: failReasons.size === 0 && commercialReadiness >= 82,
    overallScore,
    failReasons: Array.from(failReasons),
    scores,
    metrics: {
      width,
      height,
      foregroundPixels,
      foregroundCoveragePercent: Number(((foregroundPixels / totalPixels) * 100).toFixed(3)),
      semiTransparentPixels,
      connectedComponentCount: components.length,
      largestComponentSharePercent: Number((largestShare * 100).toFixed(2)),
      edgeHaloPixels: edge.haloPixels,
      insideEdgePixels: edge.insideEdgePixels,
      backgroundLikeForegroundPixels: edge.backgroundLikeForegroundPixels,
      sourcePixelChangedPercent: Number((sourceIntegrity.changedRatio * 100).toFixed(4)),
      sourcePixelMeanDelta: Number(sourceIntegrity.meanDelta.toFixed(3)),
      referenceWidthRatio: Number(geometry.widthRatio.toFixed(4)),
      referenceHeightRatio: Number(geometry.heightRatio.toFixed(4)),
      referenceAreaRatio: Number(geometry.areaRatio.toFixed(4))
    },
    overlays
  };
};

export const combinePreserveQaResults = (
  programmaticPassed: boolean,
  visionPassed: boolean
): "Passed" | "Failed" => programmaticPassed && visionPassed ? "Passed" : "Failed";

const extractAlpha = (rgba: Buffer): Buffer => {
  const alpha = Buffer.alloc(rgba.length / 4);
  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    alpha[pixel] = rgba[pixel * 4 + 3] ?? 0;
  }
  return alpha;
};

const countAlpha = (alpha: Buffer): number => {
  let count = 0;
  for (const value of alpha) {
    if (value >= alphaThreshold) count += 1;
  }
  return count;
};

const countSemiTransparent = (alpha: Buffer): number => {
  let count = 0;
  for (const value of alpha) {
    if (value > 0 && value < 245) count += 1;
  }
  return count;
};

const getAlphaBounds = (alpha: Buffer, width: number, height: number): Bounds | null => {
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
    ? { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 }
    : null;
};

const getConnectedComponents = (alpha: Buffer, width: number, height: number): number[][] => {
  const visited = new Uint8Array(alpha.length);
  const components: number[][] = [];

  for (let start = 0; start < alpha.length; start += 1) {
    if (visited[start] || (alpha[start] ?? 0) < alphaThreshold) continue;
    const stack = [start];
    const component: number[] = [];
    visited[start] = 1;

    while (stack.length > 0) {
      const pixel = stack.pop() as number;
      component.push(pixel);
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const neighbors = [
        x > 0 ? pixel - 1 : -1,
        x < width - 1 ? pixel + 1 : -1,
        y > 0 ? pixel - width : -1,
        y < height - 1 ? pixel + width : -1
      ];

      for (const next of neighbors) {
        if (next < 0 || visited[next] || (alpha[next] ?? 0) < alphaThreshold) continue;
        visited[next] = 1;
        stack.push(next);
      }
    }

    components.push(component);
  }

  return components.sort((a, b) => b.length - a.length);
};

const getSourcePixelIntegrity = (
  sourceRgba: Buffer,
  cutoutRgba: Buffer,
  alpha: Buffer,
  width: number,
  height: number
) => {
  let checked = 0;
  let changed = 0;
  let totalDelta = 0;
  const confidentForeground = erode(alpha, width, height, 4);

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    if ((confidentForeground[pixel] ?? 0) < alphaThreshold) continue;
    const index = pixel * 4;
    const delta =
      Math.abs((sourceRgba[index] ?? 0) - (cutoutRgba[index] ?? 0)) +
      Math.abs((sourceRgba[index + 1] ?? 0) - (cutoutRgba[index + 1] ?? 0)) +
      Math.abs((sourceRgba[index + 2] ?? 0) - (cutoutRgba[index + 2] ?? 0));
    checked += 1;
    totalDelta += delta / 3;
    if (delta > 9) changed += 1;
  }

  const changedRatio = checked > 0 ? changed / checked : 1;
  const meanDelta = checked > 0 ? totalDelta / checked : 255;
  return {
    passed: changedRatio <= 0.006 && meanDelta <= 1.2,
    changedRatio,
    meanDelta,
    score: Math.max(0, 100 - changedRatio * 1200 - meanDelta * 8)
  };
};

const inspectEdgeResidue = (
  sourceRgba: Buffer,
  cutoutRgba: Buffer,
  alpha: Buffer,
  width: number,
  height: number,
  referenceAlpha: Buffer | null
) => {
  const background = getBorderPalette(sourceRgba, width, height);
  const eroded = erode(alpha, width, height, 3);
  const haloMask = Buffer.alloc(alpha.length);
  let insideEdgePixels = 0;
  let haloPixels = 0;
  let backgroundLikeForegroundPixels = 0;

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    if ((alpha[pixel] ?? 0) < alphaThreshold) continue;
    const index = pixel * 4;
    const r = cutoutRgba[index] ?? 0;
    const g = cutoutRgba[index + 1] ?? 0;
    const b = cutoutRgba[index + 2] ?? 0;
    const edgePixel = (eroded[pixel] ?? 0) < alphaThreshold;
    const backgroundLike = isBackgroundLike(r, g, b, background);
    const structurallySupported = (referenceAlpha?.[pixel] ?? 0) >= alphaThreshold;
    const edgeDetail = getRgbGradientMagnitude(sourceRgba, width, height, pixel);
    const residueLike = backgroundLike && (
      (edgePixel && edgeDetail < 12) ||
      (!edgePixel && !structurallySupported && edgeDetail < 6)
    );

    if (residueLike) {
      backgroundLikeForegroundPixels += 1;
    }

    if (edgePixel) {
      insideEdgePixels += 1;
      if (residueLike || ((alpha[pixel] ?? 0) > 0 && (alpha[pixel] ?? 0) < 245)) {
        haloPixels += 1;
        haloMask[pixel] = 255;
      }
    }
  }

  return { insideEdgePixels, haloPixels, backgroundLikeForegroundPixels, haloMask };
};

const getBorderPalette = (rgba: Buffer, width: number, height: number) => {
  const samples: Array<{ r: number; g: number; b: number }> = [];
  const step = Math.max(1, Math.round(Math.min(width, height) / 80));

  for (let y = 0; y < height; y += step) {
    for (const x of [0, Math.min(width - 1, step), Math.max(0, width - 1 - step), width - 1]) {
      const index = (y * width + x) * 4;
      samples.push({ r: rgba[index] ?? 0, g: rgba[index + 1] ?? 0, b: rgba[index + 2] ?? 0 });
    }
  }
  for (let x = 0; x < width; x += step) {
    for (const y of [0, Math.min(height - 1, step), Math.max(0, height - 1 - step), height - 1]) {
      const index = (y * width + x) * 4;
      samples.push({ r: rgba[index] ?? 0, g: rgba[index + 1] ?? 0, b: rgba[index + 2] ?? 0 });
    }
  }

  return samples;
};

const isBackgroundLike = (r: number, g: number, b: number, palette: Array<{ r: number; g: number; b: number }>): boolean => {
  const saturation = getSaturation(r, g, b);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const channelSpread = Math.max(r, g, b) - Math.min(r, g, b);
  const paleNeutral = luminance > 118 && saturation < 0.14 && channelSpread < 34;
  const closeToBorder = palette.some((sample) => {
    const sampleLuminance = 0.2126 * sample.r + 0.7152 * sample.g + 0.0722 * sample.b;
    if (luminance < 70 || sampleLuminance < 55) {
      return false;
    }
    const distance = Math.abs(sample.r - r) + Math.abs(sample.g - g) + Math.abs(sample.b - b);
    return distance < 62;
  });

  return paleNeutral || closeToBorder;
};

const getRgbGradientMagnitude = (
  rgba: Buffer,
  width: number,
  height: number,
  pixel: number
): number => {
  const x = pixel % width;
  const y = Math.floor(pixel / width);
  const left = (y * width + Math.max(0, x - 1)) * 4;
  const right = (y * width + Math.min(width - 1, x + 1)) * 4;
  const up = (Math.max(0, y - 1) * width + x) * 4;
  const down = (Math.min(height - 1, y + 1) * width + x) * 4;
  const dx =
    Math.abs((rgba[right] ?? 0) - (rgba[left] ?? 0)) +
    Math.abs((rgba[right + 1] ?? 0) - (rgba[left + 1] ?? 0)) +
    Math.abs((rgba[right + 2] ?? 0) - (rgba[left + 2] ?? 0));
  const dy =
    Math.abs((rgba[down] ?? 0) - (rgba[up] ?? 0)) +
    Math.abs((rgba[down + 1] ?? 0) - (rgba[up + 1] ?? 0)) +
    Math.abs((rgba[down + 2] ?? 0) - (rgba[up + 2] ?? 0));

  return (dx + dy) / 6;
};

const getSaturation = (r: number, g: number, b: number): number => {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  return max === 0 ? 0 : (max - min) / max;
};

const erode = (alpha: Buffer, width: number, height: number, radius: number): Buffer => {
  const output = Buffer.from(alpha);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if ((alpha[pixel] ?? 0) < alphaThreshold) {
        output[pixel] = 0;
        continue;
      }
      for (let ny = Math.max(0, y - radius); ny <= Math.min(height - 1, y + radius); ny += 1) {
        for (let nx = Math.max(0, x - radius); nx <= Math.min(width - 1, x + radius); nx += 1) {
          if ((alpha[ny * width + nx] ?? 0) < alphaThreshold) {
            output[pixel] = 0;
            ny = height;
            break;
          }
        }
      }
    }
  }
  return output;
};

const compareReferenceGeometry = (
  alpha: Buffer,
  width: number,
  height: number,
  sourceReferenceAlpha: Buffer,
  referenceWidth: number,
  referenceHeight: number
) => {
  const bounds = getAlphaBounds(alpha, width, height);
  const resizedReference = referenceWidth === width && referenceHeight === height
    ? sourceReferenceAlpha
    : sourceReferenceAlpha;
  const referenceBounds = getAlphaBounds(resizedReference, referenceWidth, referenceHeight);

  if (!bounds || !referenceBounds) {
    return { passed: false, widthRatio: 0, heightRatio: 0, areaRatio: 0 };
  }

  const widthRatio = bounds.width / Math.max(1, referenceBounds.width);
  const heightRatio = bounds.height / Math.max(1, referenceBounds.height);
  const areaRatio = countAlpha(alpha) / Math.max(1, countAlpha(resizedReference));

  const hardPixelLoss = widthRatio < 0.86 || heightRatio < 0.56 || areaRatio < 0.58;
  const likelyReferenceOverreach = areaRatio >= 0.62 && widthRatio >= 0.9;

  return {
    passed: !hardPixelLoss && (likelyReferenceOverreach || (heightRatio >= 0.72 && areaRatio >= 0.68)),
    widthRatio,
    heightRatio,
    areaRatio
  };
};

const scoreFromRatio = (bad: number, total: number, failRatio: number): number =>
  Math.round(Math.max(0, Math.min(100, 100 - (bad / Math.max(1, total) / failRatio) * 100)));

const buildAlphaPreview = async (alpha: Buffer, width: number, height: number): Promise<Buffer> =>
  sharp(alpha, { raw: { width, height, channels: 1 } }).png().toBuffer();

const buildRingPreview = async (alpha: Buffer, width: number, height: number): Promise<Buffer> => {
  const eroded = erode(alpha, width, height, 4);
  const ring = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    if ((alpha[pixel] ?? 0) >= alphaThreshold && (eroded[pixel] ?? 0) < alphaThreshold) {
      const index = pixel * 4;
      ring[index] = 255;
      ring[index + 1] = 196;
      ring[index + 2] = 0;
      ring[index + 3] = 210;
    }
  }
  return sharp(ring, { raw: { width, height, channels: 4 } }).png().toBuffer();
};

const buildHaloOverlay = async (sourceRgba: Buffer, haloMask: Buffer, width: number, height: number): Promise<Buffer> => {
  const overlay = Buffer.from(sourceRgba);
  for (let pixel = 0; pixel < haloMask.length; pixel += 1) {
    if ((haloMask[pixel] ?? 0) < alphaThreshold) continue;
    const index = pixel * 4;
    overlay[index] = 255;
    overlay[index + 1] = 38;
    overlay[index + 2] = 38;
    overlay[index + 3] = 255;
  }
  return sharp(overlay, { raw: { width, height, channels: 4 } }).png().toBuffer();
};

const buildComponentsOverlay = async (sourceRgba: Buffer, components: number[][], width: number, height: number): Promise<Buffer> => {
  const overlay = Buffer.from(sourceRgba);
  const colours = [[34, 197, 94], [59, 130, 246], [245, 158, 11], [236, 72, 153], [168, 85, 247]];
  components.slice(0, 30).forEach((component, index) => {
    const colour = colours[index % colours.length] as number[];
    for (const pixel of component) {
      const offset = pixel * 4;
      overlay[offset] = colour[0] ?? 255;
      overlay[offset + 1] = colour[1] ?? 0;
      overlay[offset + 2] = colour[2] ?? 0;
      overlay[offset + 3] = 230;
    }
  });
  return sharp(overlay, { raw: { width, height, channels: 4 } }).png().toBuffer();
};

const buildCheckerboardPreview = async (cutoutRgba: Buffer, width: number, height: number): Promise<Buffer> => {
  const background = Buffer.alloc(width * height * 4);
  const square = 24;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const light = (Math.floor(x / square) + Math.floor(y / square)) % 2 === 0 ? 238 : 204;
      const index = (y * width + x) * 4;
      background[index] = light;
      background[index + 1] = light;
      background[index + 2] = light;
      background[index + 3] = 255;
    }
  }

  return sharp(background, { raw: { width, height, channels: 4 } })
    .composite([{ input: await sharp(cutoutRgba, { raw: { width, height, channels: 4 } }).png().toBuffer(), top: 0, left: 0 }])
    .png()
    .toBuffer();
};
