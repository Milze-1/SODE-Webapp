import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { cn } from "@/lib/utils";
import { NavigationLoader } from "@/components/NavigationLoader";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "The School of Daniels & Esthers",
  description: "Spiritually deep. Excellent in the marketplace.",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
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
        <Suspense>
          <NavigationLoader />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
