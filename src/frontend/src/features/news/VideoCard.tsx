/**
 * @module
 * A video of a feature: a poster that opens the video on YouTube in the browser.
 */

import { Play } from "lucide-react";
import { notify } from "@/lib/notify";
import { openExternal } from "@/lib/open-external";
import type { ChangelogVideo } from "./changelog";
import { RemoteImage } from "./RemoteImage";

/** The poster used when a video has none: the chart on graph paper of the ATUS identity. */
function DefaultPoster() {
  return (
    <svg
      viewBox="0 0 640 360"
      role="img"
      aria-label="Gráfico de pontos sobre papel milimetrado"
      className="aspect-video w-full"
    >
      <rect width="640" height="360" fill="#20272C" />
      <path
        d="M0 40H640M0 80H640M0 120H640M0 160H640M0 200H640M0 240H640M0 280H640M0 320H640M40 0V360M80 0V360M120 0V360M160 0V360M200 0V360M240 0V360M280 0V360M320 0V360M360 0V360M400 0V360M440 0V360M480 0V360M520 0V360M560 0V360M600 0V360"
        stroke="#2B3439"
      />
      <path
        d="M80 290C200 280 300 220 380 160S520 80 580 60"
        fill="none"
        stroke="#F7F7F3"
        strokeWidth="4"
      />
      <g fill="#364CFF" stroke="#C9CFFF" strokeWidth="3">
        <circle cx="130" cy="285" r="9" />
        <circle cx="220" cy="262" r="9" />
        <circle cx="310" cy="215" r="9" />
        <circle cx="400" cy="150" r="9" />
        <circle cx="490" cy="100" r="9" />
      </g>
    </svg>
  );
}

/**
 * Poster, play button and title of a video. Clicking opens it on YouTube in the default browser;
 * the app never loads the player itself.
 *
 * @param props - The video.
 * @returns The video card.
 */
export function VideoCard({ video }: { video: ChangelogVideo }) {
  return (
    <button
      type="button"
      aria-label={`Assistir "${video.title}" no YouTube (abre no navegador)`}
      onClick={() =>
        void openExternal(video.url).catch(() =>
          notify.error("Não foi possível abrir o navegador", {
            description: "Tente novamente.",
            id: "news-video-error",
          }),
        )
      }
      className="group flex w-full max-w-[420px] flex-col gap-2 text-left"
    >
      <span className="relative block overflow-hidden rounded-md [clip-path:polygon(0_0,100%_0,100%_calc(100%-18px),calc(100%-18px)_100%,0_100%)]">
        {video.poster ? (
          <RemoteImage
            key={video.poster}
            src={video.poster}
            alt=""
            className="aspect-video w-full object-cover"
          />
        ) : (
          <DefaultPoster />
        )}
        <span className="absolute inset-0 grid place-items-center bg-[#14191c]/25 transition-colors group-hover:bg-[#14191c]/10">
          <span className="grid size-10 place-items-center rounded-full bg-background shadow-lg transition-transform group-hover:scale-105">
            <Play aria-hidden size={14} className="ml-0.5 fill-foreground" />
          </span>
        </span>
        <span
          aria-hidden="true"
          className="absolute right-0 bottom-0 size-[13px] bg-brand-coral [clip-path:polygon(100%_0,100%_100%,0_100%)]"
        />
      </span>
      <span className="flex flex-col">
        <span className="text-xs font-semibold group-hover:underline">{video.title}</span>
        <span className="font-mono text-[10px] tracking-[.06em] text-muted-foreground uppercase">
          YouTube ↗
        </span>
      </span>
    </button>
  );
}
