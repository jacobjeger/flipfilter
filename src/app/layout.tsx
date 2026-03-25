import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KosherFlip — Kosher Phone Setup Tool",
  description: "Free browser-based flip phone filtering tool. No installation required. Connect via USB and filter your kosher phone directly from the browser.",
  keywords: ["kosher phone", "flip phone", "phone filtering", "WebADB", "kosher flip"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr">
      <body className="antialiased min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}
