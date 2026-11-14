/**
 * @module
 * The news page: the history of versions and the notes of the selected one.
 */

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  compareVersions,
  formatDay,
  type ChangelogFeature,
  type ChangelogVersion,
} from "./changelog";
import { Gallery } from "./Gallery";
import { Inline } from "./Inline";
import { NewsUpdateFooter } from "./NewsUpdateFooter";
import { RemoteImage } from "./RemoteImage";
import { VideoCard } from "./VideoCard";

function SectionLabel({ children, count }: { children: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between border-b-2 border-foreground pb-2 font-mono text-[10.5px] font-bold tracking-[.12em] uppercase">
      <h3>{children}</h3>
      <span className="font-normal tracking-normal text-muted-foreground">{count}</span>
    </div>
  );
}

function FeatureBlock({ feature }: { feature: ChangelogFeature }) {
  const media = feature.video ? (
    <VideoCard video={feature.video} />
  ) : feature.images.length > 0 ? (
    <Gallery images={feature.images} />
  ) : null;
  return (
    <article className="grid gap-5 border-b border-border py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,230px)]">
      <div className={cn("flex min-w-0 flex-col gap-2", !media && "sm:col-span-2")}>
        <h4 className="text-[17px] leading-tight font-bold tracking-[-.025em]">{feature.title}</h4>
        {feature.text.map((paragraph, index) => (
          <p key={index} className="text-[13.5px] leading-[1.6] text-foreground/80">
            <Inline text={paragraph} />
          </p>
        ))}
      </div>
      {media}
    </article>
  );
}

function SmallList({
  title,
  items,
  mark,
  markClass,
}: {
  title: string;
  items: string[];
  mark: string;
  markClass: string;
}) {
  return (
    <section>
      <SectionLabel count={items.length}>{title}</SectionLabel>
      <ul>
        {items.map((item, index) => (
          <li
            key={index}
            className="grid grid-cols-[16px_minmax(0,1fr)] gap-2 border-b border-muted py-2.5 text-[13px] leading-6 text-foreground/80"
          >
            <span
              aria-hidden="true"
              className={cn("font-mono text-xs leading-6 font-bold", markClass)}
            >
              {mark}
            </span>
            <span>
              <Inline text={item} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function VersionContent({ version }: { version: ChangelogVersion }) {
  const lists = [
    { title: "Melhorias", items: version.improvements, mark: "↑", markClass: "text-success" },
    { title: "Correções", items: version.fixes, mark: "✓", markClass: "text-muted-foreground" },
  ].filter((list) => list.items.length > 0);
  return (
    <article
      aria-label={`Novidades da versão ${version.version}`}
      className="mx-auto flex max-w-[700px] flex-col gap-7 px-7 pt-6 pb-12"
    >
      <header className="flex flex-col gap-2">
        <p className="flex gap-2.5 font-mono text-[10.5px] font-bold tracking-[.1em] text-muted-foreground uppercase">
          <span className="text-destructive">Versão {version.version}</span>
          <span>{formatDay(version.date)}</span>
        </p>
        <h2 className="text-[34px] leading-none font-extrabold tracking-[-.05em]">
          {version.title}
        </h2>
        <p className="max-w-[54ch] text-[15px] leading-6 text-foreground/80">{version.summary}</p>
      </header>
      {version.cover && (
        <div className="relative">
          <RemoteImage
            key={version.cover}
            src={version.cover}
            alt={`Capa da versão ${version.version}`}
            className="aspect-video w-full rounded-lg bg-muted object-cover [clip-path:polygon(0_0,100%_0,100%_calc(100%-44px),calc(100%-44px)_100%,0_100%)]"
          />
          <span
            aria-hidden="true"
            className="absolute right-0 bottom-0 size-[34px] bg-brand-coral [clip-path:polygon(100%_0,100%_100%,0_100%)]"
          />
        </div>
      )}
      {version.features.length > 0 && (
        <section>
          <SectionLabel count={version.features.length}>Novidades</SectionLabel>
          {version.features.map((feature, index) => (
            <FeatureBlock key={index} feature={feature} />
          ))}
        </section>
      )}
      {lists.length > 0 && (
        <div className={cn("grid gap-7", lists.length > 1 && "md:grid-cols-2")}>
          {lists.map((list) => (
            <SmallList key={list.title} {...list} />
          ))}
        </div>
      )}
    </article>
  );
}

interface NewsPageProps {
  /** Notes of every version, newest first. */
  versions: ChangelogVersion[];
  /** The version running now; newer ones are marked as new. */
  installed: string;
  /** The version whose notes are open. */
  selected: string;
  /** Called with the version the person picked in the list. */
  onSelect: (version: string) => void;
}

/**
 * The news page: a list of versions on the left, from the newest, with the installed one marked
 * and the newer ones flagged, and the notes of the selected version on the right. The foot of the
 * list shows where the update is and installs it.
 *
 * @param props - The notes, the installed version, the selected version and the selection handler.
 * @returns The page.
 */
export function NewsPage({ versions, installed, selected, onSelect }: NewsPageProps) {
  const current = versions.find((item) => item.version === selected) ?? versions[0];
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    content.current?.scrollTo?.({ top: 0 });
  }, [current?.version]);
  if (!current) {
    return (
      <p className="p-8 text-sm text-muted-foreground">Ainda não há novidades para mostrar.</p>
    );
  }
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[208px_minmax(0,1fr)] bg-background max-sm:grid-cols-1 max-sm:grid-rows-[auto_minmax(0,1fr)]">
      <aside
        aria-label="Versões"
        className="flex min-h-0 flex-col border-r border-border bg-[#f2f4ef] max-sm:border-r-0 max-sm:border-b"
      >
        <header className="flex flex-col px-[18px] pt-[18px] pb-2 max-sm:hidden">
          <span className="font-mono text-[10px] font-bold tracking-[.12em] text-muted-foreground uppercase">
            Histórico
          </span>
          <h1 className="text-[19px] leading-tight font-extrabold tracking-[-.035em]">Novidades</h1>
        </header>
        <ul className="relative flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pt-2 pb-3 max-sm:flex-none max-sm:flex-row max-sm:overflow-x-auto max-sm:overflow-y-hidden max-sm:p-2">
          {versions.map((item) => {
            const difference = compareVersions(item.version, installed);
            return (
              <li key={item.version} className="max-sm:shrink-0">
                <button
                  type="button"
                  aria-current={item.version === current.version ? "true" : undefined}
                  onClick={() => onSelect(item.version)}
                  className={cn(
                    "grid w-full grid-cols-[16px_minmax(0,1fr)] items-start gap-2.5 rounded-[7px] p-2 text-left hover:bg-muted",
                    item.version === current.version &&
                      "bg-card shadow-[0_0_0_1px_var(--color-border)] hover:bg-card",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-[3px] size-[11px] justify-self-center rounded-full border-2",
                      difference > 0 && "border-brand-coral bg-brand-coral",
                      difference === 0 && "border-foreground bg-foreground",
                      difference < 0 && "border-muted-foreground bg-[#f2f4ef]",
                    )}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-1.5 font-mono text-xs font-bold">
                      {item.version}
                      {difference > 0 && (
                        <span className="rounded-[3px] bg-[#fde6e0] px-1 py-[3px] text-[9px] tracking-[.08em] text-destructive uppercase">
                          nova
                        </span>
                      )}
                      {difference === 0 && (
                        <span className="rounded-[3px] bg-muted px-1 py-[3px] text-[9px] tracking-[.08em] text-muted-foreground uppercase">
                          instalada
                        </span>
                      )}
                    </span>
                    <span className="text-[12.5px] leading-snug text-muted-foreground max-sm:hidden">
                      {item.title}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-2 border-t border-border p-3.5 max-sm:hidden">
          <NewsUpdateFooter installed={installed} />
        </div>
      </aside>
      <div ref={content} className="min-h-0 overflow-y-auto">
        <VersionContent key={current.version} version={current} />
        <div className="border-t border-border p-3.5 sm:hidden">
          <NewsUpdateFooter installed={installed} />
        </div>
      </div>
    </div>
  );
}
