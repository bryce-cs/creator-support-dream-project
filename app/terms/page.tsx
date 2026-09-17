import TermsPage from "@/components/TermsPage";

// Rendered per request so the first visit after the applications cutoff
// already shows the closed buttons, with no deploy or rebuild needed.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Terms & Conditions - The Big Idea Fund",
  description: "Official Rules for THE BIG IDEA CONTEST (A Skill-Based Contest).",
};

export default function Page() {
  return <TermsPage />;
}
