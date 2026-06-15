import type { Metadata } from "next";

import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://accessinote.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "AccessiNote",
  title: {
    default: "AccessiNote",
    template: "%s | AccessiNote",
  },
  description: "Accessible lecture intelligence for multimodal study materials",
  keywords: [
    "lecture accessibility",
    "OCR notes",
    "caption generation",
    "ADHD study tools",
    "screen reader notes",
    "Azure AI",
  ],
  openGraph: {
    title: "AccessiNote",
    description: "Turn lecture recordings, slides, and transcripts into accessible study systems.",
    url: siteUrl,
    siteName: "AccessiNote",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AccessiNote",
    description: "Source-grounded lecture notes, captions, OCR timelines, and accessibility exports.",
  },
  category: "education",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
