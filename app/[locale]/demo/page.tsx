import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DemoExperience } from "./demo-experience";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("demo");
  return {
    description: t("metaDescription"),
    title: t("metaTitle"),
  };
}

export default function DemoPage() {
  return <DemoExperience />;
}
