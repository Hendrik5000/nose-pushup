/** Shared brand lockup; navigation and page-specific actions belong to the owning header. */
export function AloHeaderBrand({ title }: { title: string }) {
  return (
    <>
      <span className="alo-brand-mark">
        <img src="/alo-wordmark.png" alt="Alo" width={28} height={16} />
      </span>
      {title !== "Alo" && <strong>{title}</strong>}
    </>
  );
}
