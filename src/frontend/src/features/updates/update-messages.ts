/**
 * @module
 * Texts of the update interface, in Portuguese.
 */

import type { ManualReason } from "./update-client";

/**
 * Explains why an update must be installed by hand and what to do.
 * @param reason - Why the automatic installation is not possible.
 * @param version - Version that is waiting.
 * @returns A short sentence for people.
 */
export function manualMessage(reason: ManualReason, version: string): string {
  switch (reason) {
    case "permissionDenied":
      return `O sistema não deu permissão para instalar. Baixe a versão ${version} e instale com a ajuda de quem administra o computador.`;
    case "installFailed":
      return `A instalação automática não funcionou. Baixe a versão ${version} e instale por conta própria.`;
    case "notWritable":
      return `O ATUS não consegue substituir o próprio arquivo neste lugar. Baixe a versão ${version}.`;
    case "readOnlyLocation":
      return `O ATUS está rodando de um local somente leitura, como a imagem de disco. Mova-o para a pasta Aplicativos e abra de lá, ou baixe a versão ${version}.`;
    case "previousAttemptFailed":
      return `A última tentativa de instalar a versão ${version} não terminou. Se o Windows pediu permissão de administrador e ela foi negada, baixe o instalador e peça ajuda a quem administra o computador.`;
  }
}

/**
 * Formats a size in megabytes with a decimal comma.
 * @param bytes - Size in bytes.
 * @returns For example `12,3 MB`.
 */
export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * The download progress as a whole percentage.
 * @param downloaded - Bytes received.
 * @param total - Size of the package, when known.
 * @returns 0 to 100, or null when the size is unknown.
 */
export function percent(downloaded: number, total: number | null): number | null {
  if (!total || total <= 0) return null;
  return Math.min(100, Math.floor((downloaded / total) * 100));
}
