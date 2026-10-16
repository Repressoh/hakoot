export default function GameEditorLoading() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-16 rounded bg-muted/60" />
        <div className="h-4 w-2 rounded bg-muted/30" />
        <div className="h-4 w-32 rounded bg-muted" />
      </div>
      {/* Header */}
      <div className="space-y-3">
        <div className="h-8 w-64 rounded-lg bg-muted" />
        <div className="h-4 w-96 rounded-md bg-muted/60" />
      </div>
      {/* Content area */}
      <div className="rounded-2xl border border-border/50 bg-card/50 p-6">
        <div className="space-y-4">
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="space-y-3">
            <div className="h-16 w-full rounded-xl bg-muted/40" />
            <div className="h-16 w-full rounded-xl bg-muted/40" />
          </div>
        </div>
      </div>
    </div>
  );
}
