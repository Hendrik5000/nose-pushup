import type { ReactNode } from "react";
import { AloHomeLink } from "@/components/AloHomeLink";

type HomeAppMenuLayoutProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  sidebar?: ReactNode;
  children: ReactNode;
};

export function HomeAppMenuLayout({
  eyebrow,
  title,
  description,
  sidebar,
  children,
}: HomeAppMenuLayoutProps) {
  const showHeader = Boolean(title);
  const widthClass = sidebar ? "max-w-6xl" : "max-w-5xl";

  return (
    <main
      className={`alo-site-directory-page relative mx-auto flex min-h-[100dvh] w-full flex-col ${widthClass}`}
      aria-labelledby={showHeader ? "home-app-menu-title" : undefined}
      data-alo-menu-surface="true"
    >
      {showHeader && (
        <header className="flex items-start justify-between gap-6 border-b border-border/60 pb-6">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--menu-accent)]">
                {eyebrow}
              </p>
            )}
            <h1
              id="home-app-menu-title"
              className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              {title}
            </h1>
            {description && (
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <AloHomeLink className="shrink-0 border-border/70 bg-card/70 px-3" />
        </header>
      )}
      {sidebar ? (
        <div className="grid min-w-0 gap-7 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
          <aside
            aria-label="App-Aktionen"
            className="min-w-0 rounded-2xl border border-border/60 p-3 lg:sticky lg:top-6"
          >
            {sidebar}
          </aside>
          <div className="flex min-w-0 flex-col gap-7">{children}</div>
        </div>
      ) : (
        children
      )}
    </main>
  );
}
