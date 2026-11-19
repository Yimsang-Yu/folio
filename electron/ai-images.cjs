const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

function imageData(image) {
  if (!image || typeof image.name !== "string" || image.name.length > 160 || typeof image.dataUrl !== "string"
    || image.dataUrl.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 64) throw new Error("Invalid image attachment.");
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image.dataUrl);
  if (!match) throw new Error("Use a PNG, JPEG or WebP image attachment.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString("base64") !== match[2]) throw new Error("Each image must be smaller than 5 MB.");
  const valid = match[1] === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : match[1] === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  if (!valid) throw new Error("The attachment isn't a valid image of the stated type.");
  return { mime: match[1], base64: match[2], size: bytes.length };
}

function validateImages(messages) {
  let size = 0;
  for (const message of messages) {
    if (message.images === undefined) continue;
    if (message.role !== "user" || !Array.isArray(message.images) || message.images.length > 4) throw new Error("Attach up to four images per question.");
    for (const image of message.images) {
      size += imageData(image).size;
      if (size > MAX_TOTAL_BYTES) throw new Error("This conversation has more than 20 MB of images. Start a new conversation to attach more.");
    }
  }
}

module.exports = { imageData, validateImages };
