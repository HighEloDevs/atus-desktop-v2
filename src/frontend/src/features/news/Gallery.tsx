/**
 * @module
 * The images of a feature, with an enlarged view navigable by keyboard.
 */

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import type { ChangelogImage } from "./changelog";
import { RemoteImage } from "./RemoteImage";

function Lightbox({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: ChangelogImage[];
  index: number | null;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const image = index === null ? null : images[index];
  const step = (delta: number) => {
    if (index !== null) onIndex((index + delta + images.length) % images.length);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (images.length < 2) return;
    if (event.key === "ArrowLeft") step(-1);
    else if (event.key === "ArrowRight") step(1);
    else return;
    event.preventDefault();
  };
  return (
    <Dialog.Root open={image !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14191c]/90" />
        <Dialog.Content
          onKeyDown={onKeyDown}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-10 outline-none"
        >
          <Dialog.Title className="sr-only">Imagem ampliada</Dialog.Title>
          <Dialog.Description className="sr-only">{image?.alt}</Dialog.Description>
          {image && (
            <RemoteImage
              key={image.url}
              src={image.url}
              alt={image.alt}
              className="max-h-[78vh] max-w-full rounded-lg bg-white object-contain shadow-2xl"
            />
          )}
          <p className="flex items-baseline gap-3 text-sm text-white">
            <span>{image?.alt}</span>
            {images.length > 1 && index !== null && (
              <span className="text-xs text-white/60 tabular-nums">
                {index + 1} / {images.length}
              </span>
            )}
          </p>
          {images.length > 1 && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Imagem anterior"
                className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-white/15 text-white hover:bg-white/25 hover:text-white"
                onClick={() => step(-1)}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Próxima imagem"
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-white/15 text-white hover:bg-white/25 hover:text-white"
                onClick={() => step(1)}
              >
                <ChevronRight aria-hidden />
              </Button>
            </>
          )}
          <Dialog.Close asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Fechar"
              className="absolute top-3 right-3 rounded-full bg-white/15 text-white hover:bg-white/25 hover:text-white"
            >
              <X aria-hidden />
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * The images of one feature as a grid of thumbnails. Clicking one opens it enlarged, with
 * previous and next buttons, the arrow keys and Escape.
 *
 * @param props - The images to show.
 * @returns The grid and its enlarged view.
 */
export function Gallery({ images }: { images: ChangelogImage[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <div className={images.length === 1 ? "grid" : "grid grid-cols-2 gap-2"}>
        {images.map((image, index) => (
          <figure key={image.url} className="min-w-0">
            <button
              type="button"
              aria-label={`Ampliar: ${image.alt || "imagem"}`}
              onClick={() => setOpen(index)}
              className="block w-full cursor-zoom-in overflow-hidden rounded-md border border-border bg-white hover:border-muted-foreground"
            >
              <RemoteImage
                key={image.url}
                src={image.url}
                alt={image.alt}
                className="aspect-[4/3] w-full object-cover"
              />
            </button>
            {image.alt && (
              <figcaption className="mt-1.5 font-mono text-[10.5px] text-muted-foreground">
                {image.alt}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
      <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
    </>
  );
}
