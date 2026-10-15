import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Satoshi is split like Google Fonts subsets: the Latin files are half the
// size of the full fonts, and the rest of Satoshi's characters only download
// when a page uses one of them. Their unicode-range lists exactly
// the characters that file has, so text Satoshi can't render anyway doesn't
// trigger a download. Made from app/fonts/Satoshi-*.woff2 with fonttools:
//   pyftsubset <font> --flavor=woff2 --unicodes=<the file's unicode-range>
//     --layout-features=kern,mark,mkmk,ccmp,locl,liga,calt,clig,rlig,tnum
// (The Latin file also has ✓, which the game screens use.)
// globals.css lists the families by name ("satoshi", "satoshiLatinExt"),
// which next/font takes from these variable names.
//
// No font is preloaded: preloads start before the page's JavaScript and take
// bandwidth from it, and on 2G that delayed every screen's data by ~1.5s.
// Text shows in the size-matched fallback until the fonts arrive.
const satoshi = localFont({
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2190-2193, U+2212, U+2215, U+2713, U+FEFF, U+FFFD",
    },
  ],
  display: "swap",
  preload: false,
  src: [
    { path: "../fonts/subsets/Satoshi-Regular-latin.woff2", weight: "400" },
    { path: "../fonts/subsets/Satoshi-Medium-latin.woff2", weight: "500" },
    { path: "../fonts/subsets/Satoshi-Bold-latin.woff2", weight: "700" },
    { path: "../fonts/subsets/Satoshi-Black-latin.woff2", weight: "900" },
  ],
  variable: "--font-satoshi",
});

const satoshiLatinExt = localFont({
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-0123, U+0126-012B, U+012E-0130, U+0134-0137, U+0139-0148, U+014A-014D, U+0150-0151, U+0154-016B, U+016E-017E, U+0192, U+01FA-01FF, U+0218-021B, U+0237, U+02C7, U+02DD, U+0300-0303, U+0306-0307, U+030A-030C, U+0312, U+0326-0327, U+0335, U+0337-0338, U+1E80-1E85, U+1EF2-1EF3, U+2070, U+2074-2079, U+2080-2089, U+2116-2117, U+212E, U+215B-215E, U+2194-2199, U+2202, U+2205-2206, U+220F, U+2211, U+221A, U+221E, U+222B, U+2248, U+2260, U+2264-2265, U+25A0-25A1, U+25B2-25B3, U+25CA-25CB, U+25CF, U+262E, U+F8FF, U+FB00-FB04",
    },
  ],
  display: "swap",
  preload: false,
  src: [
    { path: "../fonts/subsets/Satoshi-Regular-latin-ext.woff2", weight: "400" },
    { path: "../fonts/subsets/Satoshi-Medium-latin-ext.woff2", weight: "500" },
    { path: "../fonts/subsets/Satoshi-Bold-latin-ext.woff2", weight: "700" },
    { path: "../fonts/subsets/Satoshi-Black-latin-ext.woff2", weight: "900" },
  ],
  variable: "--font-satoshi-latin-ext",
});

const spaceMono = Space_Mono({
  preload: false,
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
      className={`dark ${satoshi.variable} ${satoshiLatinExt.variable} ${spaceMono.variable}`}
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
            {children}
            <Toaster position="top-right" richColors />
          </NextIntlClientProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
