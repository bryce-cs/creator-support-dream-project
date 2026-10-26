import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Big Idea Fund - Creator Support",
  description: "Jackson and David Hughens won the first ever Big Idea Fund - $25,000 to make a five-part docuseries. Watch the pitch that won. Powered by Adobe.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
