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
  display: "swap",
  preload: true,
  src: [
    { path: "../fonts/Satoshi-Regular.woff2", style: "normal", weight: "400" },
    { path: "../fonts/Satoshi-Medium.woff2", style: "normal", weight: "500" },
    { path: "../fonts/Satoshi-Bold.woff2", style: "normal", weight: "700" },
    { path: "../fonts/Satoshi-Black.woff2", style: "normal", weight: "900" },
  ],
  variable: "--font-sans",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  alternates: {
    canonical: "https://dev.hakoot.albertocaserta.it",
  },
  authors: [{ name: "Hakoot" }],
  creator: "Hakoot",
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
  metadataBase: new URL("https://dev.hakoot.albertocaserta.it"),
  openGraph: {
    description:
      "Create engaging quizzes and host interactive learning sessions. Make education fun and effective with Hakoot.",
    images: [
      {
        alt: "Hakoot - Interactive Learning Platform",
        height: 630,
        url: "/og-image.png",
        width: 1200,
      },
    ],
    locale: "en_US",
    siteName: "Hakoot",
    title: "Hakoot - Interactive Learning Platform for Real Education",
    type: "website",
    url: "https://dev.hakoot.albertocaserta.it",
  },
  publisher: "Hakoot",
  robots: {
    follow: true,
    googleBot: {
      follow: true,
      index: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    index: true,
  },
  title: {
    default: "Hakoot - Interactive Learning Platform for Real Education",
    template: "%s | Hakoot",
  },
  twitter: {
    card: "summary_large_image",
    description:
      "Create engaging quizzes and host interactive learning sessions.",
    images: ["/og-image.png"],
    title: "Hakoot - Interactive Learning Platform",
  },
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
