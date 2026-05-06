import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "eŽádanky — DC Flipper",
  description: "Modul pro zobrazení eŽádanek pacienta",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body className="bg-brand-surface text-gray-800 antialiased">
        {children}
      </body>
    </html>
  );
}
