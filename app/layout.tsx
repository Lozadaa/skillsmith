import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skillsmith",
  description: "Create, analyze and improve Claude Agent Skills",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
