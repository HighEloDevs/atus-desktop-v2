/**
 * @module
 * Renders the chart to an image and delivers it to the clipboard or the filesystem.
 *
 * In the desktop app the webview cannot do either reliably (`<a download>` is a no-op in
 * WKWebView and `navigator.clipboard.write` is unreliable), so it goes through the native
 * clipboard plugin, the save dialog and the `export_image_write` command. In a plain browser it
 * falls back to the standard APIs.
 */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeImage } from "@tauri-apps/plugin-clipboard-manager";
import html2canvas from "html2canvas-pro";

/** Image formats the chart can be saved as. */
export type ImageFormat = "png" | "jpeg";

/** Outcome of saving a file: the chosen path (or file name in a browser), or `null` if cancelled. */
export type SaveResult = string | null;

const JPEG_QUALITY = 0.92;

/**
 * Draws the element on a white background at twice its size.
 * @param element - The chart container.
 * @param format - The encoding to produce.
 * @returns The encoded image bytes.
 * @throws {Error} When rendering or encoding fails.
 */
export async function renderImage(element: HTMLElement, format: ImageFormat): Promise<Blob> {
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff" });
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, `image/${format}`, format === "jpeg" ? JPEG_QUALITY : undefined),
  );
  if (!blob) throw new Error("Não foi possível gerar a imagem do gráfico.");
  return blob;
}

/**
 * Copies a PNG image to the system clipboard.
 * @param png - PNG-encoded image.
 * @throws {Error} When the clipboard is unavailable or denies the write.
 */
export async function copyImage(png: Blob): Promise<void> {
  if (isTauri()) {
    await writeImage(new Uint8Array(await png.arrayBuffer()));
    return;
  }
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Este navegador não permite copiar imagens.");
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

/**
 * Saves an image file. The desktop app asks for a destination; a browser downloads it.
 * @param image - Encoded image.
 * @param format - Format of `image`, used for the default name and extension filter.
 * @returns The chosen path, or `null` when the user cancels the dialog.
 * @throws {Error} When the file cannot be written.
 */
export async function saveImage(image: Blob, format: ImageFormat): Promise<SaveResult> {
  const extension = format === "jpeg" ? "jpg" : "png";
  const name = `grafico.${extension}`;
  if (!isTauri()) {
    const url = URL.createObjectURL(image);
    const link = document.createElement("a");
    link.download = name;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return name;
  }
  const path = await save({
    defaultPath: name,
    filters: [{ name: format === "jpeg" ? "JPEG" : "PNG", extensions: [extension] }],
  });
  if (!path) return null;
  await invoke("export_image_write", new Uint8Array(await image.arrayBuffer()), {
    headers: { path: encodeURIComponent(path) },
  });
  return path;
}

/**
 * Extracts a readable message from an unknown failure (Tauri rejects with plain strings).
 * @param error - The caught value.
 * @returns A non-empty message.
 */
export function errorMessage(error: unknown): string {
  if (typeof error === "string" && error) return error;
  if (error instanceof Error && error.message) return error.message;
  return "erro desconhecido.";
}
