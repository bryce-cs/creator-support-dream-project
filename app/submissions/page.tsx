import SubmissionsPage from "@/components/SubmissionsPage";
import { loadSubmissions } from "@/lib/submissions-server";

export const dynamic = "force-dynamic"; // re-read JSON on every request

export const metadata = {
  title: "Submissions — The Big Idea Fund",
  description: "Browse submissions to The Big Idea Fund.",
};

export default function Page() {
  const submissions = loadSubmissions();
  return <SubmissionsPage submissions={submissions} />;
}
