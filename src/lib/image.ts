/**
 * Shrinks a photo in the browser before upload: receipts don't need 12
 * megapixels, and a smaller image is cheaper for the model to read. Small
 * files go as they are, and any decoding trouble falls back to the original.
 */
const SMALL_ENOUGH = 1_500_000;

export async function shrinkImage(file: File, maxSide = 1600, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < SMALL_ENOUGH) return file;
  const timeout = new Promise<File>((resolve) => setTimeout(() => resolve(file), 4000));
  return Promise.race([resize(file, maxSide, quality), timeout]);
}

async function resize(file: File, maxSide: number, quality: number): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    return blob
      ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" })
      : file;
  } catch {
    return file;
  }
}
