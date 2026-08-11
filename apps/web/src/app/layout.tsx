import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Nav } from "../components/nav";

export const metadata: Metadata = {
  title: "Póca — Personal Finance",
  description: "Open-source personal finance tracking for Ireland",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}
