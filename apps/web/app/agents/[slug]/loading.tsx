function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <section className="grid grid-cols-1 gap-10 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:py-14">
        <div>
          <Block className="h-4 w-20" />
          <div className="mt-3 flex items-center gap-4">
            <Block className="h-14 w-14 rounded-full" />
            <Block className="h-8 w-48" />
          </div>
          <Block className="mt-5 h-4 w-full max-w-xl" />
          <Block className="mt-2 h-4 w-2/3 max-w-xl" />
          <div className="mt-8 flex gap-3">
            <Block className="h-10 w-32" />
            <Block className="h-10 w-28" />
          </div>
        </div>
        <Block className="h-80 rounded-xl" />
      </section>
      <div className="grid grid-cols-1 gap-6 pb-6 lg:grid-cols-[1.5fr_1fr]">
        <Block className="h-64 rounded-xl" />
        <Block className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
