import { ConvexClientProvider } from "@/components/convex-client-provider";
import { Toaster } from "@/components/ui/sonner";

/**
 * Every screen except the landing page talks to Convex, so they share one
 * client provider here; moving between them keeps it (and its sign-in state)
 * mounted. The landing page is outside this group: the Convex client and auth
 * are ~28 KB of gzipped JavaScript it only needs once someone joins a game.
 * The same goes for the toast container (the landing page has a lazy one).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexClientProvider>
      {children}
      <Toaster position="top-right" richColors />
    </ConvexClientProvider>
  );
}
