import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Hakoot",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    applicationCategory: "EducationalApplication",
    description: "Interactive learning platform for real education",
    name: "Hakoot",
    operatingSystem: "Web",
    url: "https://dev.hakoot.albertocaserta.it",
  };

  return (
    <>
      {children}
      <Script
        id="schema-org"
        strategy="afterInteractive"
        type="application/ld+json"
      >
        {JSON.stringify(schema)}
      </Script>
    </>
  );
}
