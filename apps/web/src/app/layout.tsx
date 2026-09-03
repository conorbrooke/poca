import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Póca — Personal Finance",
  description: "Open-source personal finance tracking for Ireland",
  icons: {
    icon: [{ url: "/poca-mark.png", type: "image/png" }],
    apple: [{ url: "/poca-mark.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sans.variable}>
      <body className={sans.className}>{children}</body>
    </html>
  );
}
