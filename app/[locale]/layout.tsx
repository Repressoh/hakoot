import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { routing } from "@/i18n/routing";
import "../globals.css";

const satoshi = localFont({
  src: [
    { path: "../fonts/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Satoshi-Bold.woff2", weight: "700", style: "normal" },
    { path: "../fonts/Satoshi-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
  preload: true,
});

const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Hakoot - Interactive Learning Platform for Real Education",
    template: "%s | Hakoot",
  },
  description:
    "Hakoot is an interactive learning platform that makes education engaging and effective. Create custom quizzes, host live sessions, and track student progress in real-time.",
  keywords: [
    "interactive learning",
    "online quiz",
    "education platform",
    "kahoot alternative",
    "live quiz",
    "student engagement",
    "classroom games",
    "learning tools",
  ],
  authors: [{ name: "Hakoot" }],
  creator: "Hakoot",
  publisher: "Hakoot",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://dev.hakoot.albertocaserta.it",
    siteName: "Hakoot",
    title: "Hakoot - Interactive Learning Platform for Real Education",
    description:
      "Create engaging quizzes and host interactive learning sessions. Make education fun and effective with Hakoot.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Hakoot - Interactive Learning Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hakoot - Interactive Learning Platform",
    description:
      "Create engaging quizzes and host interactive learning sessions.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://dev.hakoot.albertocaserta.it",
  },
  metadataBase: new URL("https://dev.hakoot.albertocaserta.it"),
};

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "en" | "it")) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html
      className={`dark ${satoshi.variable} ${spaceMono.variable}`}
      lang={locale}
    >
      <head>
        <link href="/favicon.ico" rel="icon" sizes="any" />
        <link href="/apple-touch-icon.png" rel="apple-touch-icon" />
        <link href="/manifest.json" rel="manifest" />
        <meta content="#000000" name="theme-color" />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ConvexClientProvider>
          <NextIntlClientProvider messages={messages}>
            <TooltipProvider>
              {children}
              <Toaster position="top-right" richColors />
            </TooltipProvider>
          </NextIntlClientProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
