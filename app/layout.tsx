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
    icon: [
      { url: "/sode-logo.png", type: "image/png", sizes: "192x192" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/sode-logo.png",
    apple: "/sode-logo.png",
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
