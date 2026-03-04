export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-10">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2.5">
          <div className="h-8 w-56 rounded-lg bg-muted" />
          <div className="h-4 w-72 rounded-md bg-muted/60" />
        </div>
        <div className="h-11 w-36 rounded-xl bg-muted" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {["a", "b", "c"].map((id) => (
          <div
            className="space-y-4 rounded-2xl border border-border/50 bg-card/50 p-5"
            key={id}
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-3/4 rounded-md bg-muted" />
                <div className="h-3 w-full rounded-sm bg-muted/60" />
              </div>
            </div>
            <div className="h-6 w-20 rounded-lg bg-muted/60" />
            <div className="flex gap-2 pt-2">
              <div className="h-9 flex-1 rounded-xl bg-muted" />
              <div className="h-9 w-9 rounded-xl bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
