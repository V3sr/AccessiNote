import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AccessiNote",
  description: "Accessible lecture intelligence for multimodal study materials",
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
