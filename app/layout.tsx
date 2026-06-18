import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "The School of Daniels & Esthers",
  description: "Spiritually deep. Excellent in the marketplace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(hankenGrotesk.variable)}>
      <body
        className="antialiased"
        style={{ fontFamily: "var(--font-hanken), system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
