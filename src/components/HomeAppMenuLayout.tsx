import type { ReactNode } from "react";
import { AloHomeLink } from "@/components/AloHomeLink";
import { DesignView } from "@/components/DesignView";

type HomeAppMenuLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

function MenuFrame({
  variant,
  eyebrow,
  title,
  description,
  children,
}: HomeAppMenuLayoutProps & { variant: "sport" | "classic" }) {
  const frameClass =
    variant === "sport" ? "sport-only px-5 py-6 sm:px-8" : "classic-only px-5 pt-6 pb-10 sm:px-8";

  return (
    <main
      className={`relative mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col gap-6 ${frameClass}`}
      aria-labelledby="home-app-menu-title"
      data-alo-menu-surface="true"
    >
      <header className="flex items-start justify-between gap-4 border-b border-border/60 pb-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--menu-accent)]">
            {eyebrow}
          </p>
          <h1
            id="home-app-menu-title"
            className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
          >
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <AloHomeLink className="border-border/70 bg-card/70 px-2.5 sm:px-3" />
      </header>
      {children}
    </main>
  );
}

export function HomeAppMenuLayout(props: HomeAppMenuLayoutProps) {
  return (
    <>
      <DesignView variant="sport">
        <MenuFrame {...props} variant="sport" />
      </DesignView>
      <DesignView variant="classic">
        <MenuFrame {...props} variant="classic" />
      </DesignView>
    </>
  );
}
