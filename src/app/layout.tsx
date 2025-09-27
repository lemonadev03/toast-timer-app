import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://timer.local"),
  title: {
    default: "Toast Timer",
    template: "%s — Toast Timer",
  },
  description: "A colorful, configurable speaking timer.",
  icons: {
    icon: "/toast-timer-icon.png",
    shortcut: "/toast-timer-icon.png",
    apple: "/toast-timer-icon.png",
  },
  openGraph: {
    title: "Toast Timer",
    description: "Keep presentations and panels on track with a simple multi-stage countdown.",
    url: "/",
    siteName: "Toast Timer",
    type: "website",
    images: [
      {
        url: "/toast-timer-icon.png",
        width: 512,
        height: 512,
        alt: "Toast Timer logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Toast Timer",
    description: "Multi-stage speaking timer built for panels and standups.",
    images: ["/toast-timer-icon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
