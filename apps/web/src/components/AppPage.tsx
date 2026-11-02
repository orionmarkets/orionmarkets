import type { ReactNode } from "react";
import Link from "next/link";
import { Constellation } from "./orion/Constellation";

export function AppPage({
  eyebrow,
  title,
  description,
  children,
  back,
  backHref = "/markets",
  backLabel = "← All markets",
  banner,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  back?: boolean;
  backHref?: string;
  backLabel?: string;
  /** Seed of the star chart beside the heading; each page keeps its own figure. */
  banner?: string;
}) {
  return (
    <div className="app-page">
      {back && (
        <Link className="app-back" href={backHref}>
          {backLabel}
        </Link>
      )}
      <header className="app-page-heading" data-ribbon={banner ? "true" : undefined}>
        <div className="app-page-heading-copy">
          <span className="app-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {banner && (
          <div className="app-banner app-banner-heading" aria-hidden="true">
            <Constellation seed={banner} className="absolute inset-0" />
          </div>
        )}
      </header>
      <div className="app-page-content">{children}</div>
    </div>
  );
}

export function DataState({
  title,
  children,
  retry,
  shape = "hourglass",
}: {
  title: string;
  children: ReactNode;
  retry?: () => void;
  /** Seed of the small star chart above the message. */
  shape?: string;
}) {
  return (
    <div className="data-state" role="status" data-glyph-host="">
      <span className="emblem" aria-hidden="true">
        <Constellation seed={shape} stars={5} dense={24} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {retry && (
        <button className="app-button secondary" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
