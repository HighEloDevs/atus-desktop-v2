/**
 * @module
 * An image of the release notes that tolerates failing to load.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Shows an image from the notes. When it cannot load (no connection, or the file is gone) it
 * shows a quiet placeholder with the caption instead of a broken icon.
 *
 * @param props - The address, the caption (used as alternative text) and classes for the image.
 * @returns The image or its placeholder. Give it a `key` that changes with `src`.
 */
export function RemoteImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt || "Imagem indisponível"}
        className={cn(
          "flex items-center justify-center bg-muted p-3 text-center text-xs text-muted-foreground",
          className,
        )}
      >
        Imagem indisponível
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
