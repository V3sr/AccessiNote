import type { Metadata } from "next";

import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "AccessiNote",
  title: {
    default: "AccessiNote",
    template: "%s | AccessiNote",
  },
  description: "Turn lecture recordings, slides and transcripts into captions, screen-reader notes and focus-friendly study packs.",
  keywords: [
    "lecture accessibility",
    "OCR notes",
    "caption generation",
    "ADHD study tools",
    "screen reader notes",
    "Deaf and hard of hearing students",
    "low vision study notes",
  ],
  openGraph: {
    title: "AccessiNote",
    description: "Turn lecture recordings, slides and transcripts into accessible study notes.",
    url: siteUrl,
    siteName: "AccessiNote",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AccessiNote",
    description: "Captions, screen-reader notes and focus-friendly study packs from your lecture material.",
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
