import sharp from "sharp";

const PNG_PREFIX = "data:image/png;base64,";
const MAX_BYTES = 1024 * 1024;
const MAX_DIMENSION = 4096;
const MAX_PIXELS = 16_000_000;
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function hasExactPngEnvelope(input: Buffer): boolean {
  if (input.length < 20 || !input.subarray(0, 8).equals(PNG_MAGIC)) return false;
  let offset = 8;
  while (offset + 12 <= input.length) {
    const length = input.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > input.length) return false;
    const type = input.toString("ascii", offset + 4, offset + 8);
    offset = end;
    if (type === "IEND") return length === 0 && offset === input.length;
  }
  return false;
}

/** Decode the complete image, enforce resource limits, strip metadata, and re-encode. */
export async function decodeAndSanitizeSignature(dataUrl: string): Promise<Buffer> {
  if (!dataUrl.startsWith(PNG_PREFIX)) throw new Error("INVALID_SIGNATURE");
  const encoded = dataUrl.slice(PNG_PREFIX.length);
  if (!encoded || encoded.length > 1_400_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error("INVALID_SIGNATURE");
  }

  const input = Buffer.from(encoded, "base64");
  if (input.length < 100 || input.length > MAX_BYTES) throw new Error("INVALID_SIGNATURE");
  if (!hasExactPngEnvelope(input)) throw new Error("INVALID_SIGNATURE");

  const image = sharp(input, { failOn: "error", limitInputPixels: MAX_PIXELS });
  const metadata = await image.metadata();
  if (
    metadata.format !== "png" || !metadata.width || !metadata.height ||
    metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION ||
    metadata.width * metadata.height > MAX_PIXELS
  ) {
    throw new Error("INVALID_SIGNATURE");
  }

  return image.rotate().png({ compressionLevel: 9 }).toBuffer();
}
