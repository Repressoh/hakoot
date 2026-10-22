import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SharedGameStepsView } from "./shared-game-steps-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sharing");
  return { robots: { follow: false, index: false }, title: t("viewSteps") };
}

export default async function SharedGameStepsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="min-h-screen bg-background bg-grid">
      <main className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <SharedGameStepsView shareToken={token} />
      </main>
    </div>
  );
}
