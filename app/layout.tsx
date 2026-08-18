import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Big Idea Fund - Creator Support",
  description: "We're giving away $25k to fund a dream project. Just tell us your big idea, we're picking one to make a reality. Powered by Adobe.",
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
