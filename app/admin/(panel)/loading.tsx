export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando">
      <div className="h-10 w-64 animate-pulse rounded-2xl bg-line/70" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-2xl bg-line/60" />
        <div className="h-24 animate-pulse rounded-2xl bg-line/60" />
        <div className="h-24 animate-pulse rounded-2xl bg-line/60" />
      </div>
      <div className="h-56 animate-pulse rounded-3xl bg-line/50" />
    </div>
  );
}
