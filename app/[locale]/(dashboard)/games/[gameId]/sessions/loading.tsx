export default function SessionsLoading() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-16 rounded bg-muted/60" />
        <div className="h-4 w-2 rounded bg-muted/30" />
        <div className="h-4 w-24 rounded bg-muted/60" />
        <div className="h-4 w-2 rounded bg-muted/30" />
        <div className="h-4 w-20 rounded bg-muted" />
      </div>
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-3">
          <div className="h-8 w-48 rounded-lg bg-muted" />
          <div className="h-4 w-64 rounded-md bg-muted/60" />
        </div>
        <div className="h-10 w-32 rounded-xl bg-muted" />
      </div>
      {/* Session cards */}
      <div className="space-y-3">
        {["a", "b"].map((id) => (
          <div
            className="h-24 w-full rounded-2xl border border-border/50 bg-card/50"
            key={id}
          />
        ))}
      </div>
    </div>
  );
}
