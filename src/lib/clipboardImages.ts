/** Arquivos de imagem colados da área de transferência (print, Ctrl+V). */

export function normalizeClipboardImageFile(file: File): File {
  const hasName = file.name && file.name !== "image.png" && !file.name.startsWith("blob");
  if (hasName) return file;
  const ext =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "png";
  return new File([file], `imagem-${Date.now()}.${ext}`, { type: file.type || "image/png" });
}

export function getImageFilesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files: File[] = [];

  if (data.items?.length) {
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) files.push(normalizeClipboardImageFile(f));
      }
    }
  }

  if (!files.length && data.files?.length) {
    Array.from(data.files)
      .filter((f) => f.type.startsWith("image/"))
      .forEach((f) => files.push(normalizeClipboardImageFile(f)));
  }

  return files;
}
