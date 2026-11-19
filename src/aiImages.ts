export const MAX_IMAGES = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_HISTORY_CHARS = Math.ceil(20 * 1024 * 1024 / 3) * 4 + 1024;

export function transferredFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  if (data.files.length) return Array.from(data.files);
  return Array.from(data.items).filter(item => item.kind === "file").map(item => item.getAsFile()).filter((file): file is File => !!file);
}

export async function readAiImage(file: File): Promise<AiImage> {
  const type = file.type || ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" }[file.name.split(".").at(-1)?.toLowerCase() ?? ""]);
  if (!["image/png", "image/jpeg", "image/webp"].includes(type ?? "")) throw new Error("Attach a PNG, JPEG or WebP image. Drop PDFs outside the chat to open them.");
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error("Each image must be smaller than 5 MB.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read this image. Try attaching it again."));
    reader.readAsDataURL(new Blob([file], { type }));
  });
  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => image.naturalWidth * image.naturalHeight > 40_000_000
      ? reject(new Error("This image is too large. Attach a smaller screenshot.")) : resolve();
    image.onerror = () => reject(new Error("Couldn't open this image. Use a PNG, JPEG or WebP screenshot."));
    image.src = dataUrl;
  });
  return { name: file.name.slice(0, 160) || "Screenshot.png", dataUrl };
}
