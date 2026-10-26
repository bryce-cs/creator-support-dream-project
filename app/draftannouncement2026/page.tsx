import type { Metadata } from "next";
import WinnerCanvas from "@/components/WinnerCanvas";

/**
 * Draft of the winner announcement, parked on the live site so the team can
 * review it at a real URL before it replaces the homepage.
 *
 * The URL is public but unlisted, so keep it out of search results and out of
 * link previews — an unannounced winner should not surface in a Google result
 * or unfurl in a Slack message before the announcement goes out.
 */
export const metadata: Metadata = {
  title: "Draft - The Big Idea Fund",
  robots: { index: false, follow: false, nocache: true },
};

export default function Page() {
  return <WinnerCanvas />;
}
