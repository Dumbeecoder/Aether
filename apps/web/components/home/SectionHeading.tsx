import Link from "next/link";

export function SectionHeading({
  eyebrow,
  title,
  description,
  cta,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <span className="text-xs font-medium uppercase tracking-wide text-accent">{eyebrow}</span>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 max-w-xl text-muted-foreground">{description}</p>}
      </div>
      {cta && (
        <Link
          href={cta.href}
          className="shrink-0 text-sm font-medium text-accent hover:opacity-80"
        >
          {cta.label} →
        </Link>
      )}
    </div>
  );
}
