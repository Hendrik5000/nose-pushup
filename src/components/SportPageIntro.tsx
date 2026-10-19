import type { ReactNode } from "react";

/** Structural elements of the new UI; legacy layouts never display these blocks. */
export function SportPageIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="sport-only sport-page-intro">
      <div className="sport-eyebrow">
        <span aria-hidden="true" />
        {eyebrow}
      </div>
      <div className="sport-intro-body">
        <div>
          <h1>{title}</h1>
          {description && <p className="sport-intro-description">{description}</p>}
        </div>
        {children && <div className="sport-intro-actions">{children}</div>}
      </div>
    </header>
  );
}

export function SportSectionLabel({ number, children }: { number: string; children: ReactNode }) {
  return (
    <div className="sport-only sport-section-label">
      <span className="sport-section-number" aria-hidden="true">
        {number}
      </span>
      <h2>{children}</h2>
      <span className="sport-section-line" aria-hidden="true" />
    </div>
  );
}
