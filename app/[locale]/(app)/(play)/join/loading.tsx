export default function JoinLoading() {
  return (
    <div className="flex min-h-screen animate-pulse flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="mx-auto h-10 w-32 rounded-lg bg-muted" />
        </div>
        <div className="space-y-6 rounded-2xl border border-border/50 bg-card/80 p-6">
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-muted/60" />
            <div className="h-12 w-full rounded-xl bg-muted/40" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 rounded bg-muted/60" />
            <div className="h-12 w-full rounded-xl bg-muted/40" />
          </div>
          <div className="h-12 w-full rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
