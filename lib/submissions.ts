// Client-safe types and pure helpers. Do NOT import node modules here.

export interface Submission {
  id: string;
  title: string;
  name: string;
  youtube_url: string;
  submitted_at: string; // ISO timestamp
  likes: number;
}

export type SortOption = "recent" | "liked" | "random";

export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const short = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (short) return short[1];
  const watch = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
  if (watch) return watch[1];
  const path = url.match(/youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,})/);
  if (path) return path[1];
  return null;
}

export function youtubeThumbnail(url: string): string | null {
  const id = extractYoutubeId(url);
  if (!id) return null;
  // hqdefault is reliable across all videos; maxresdefault may 404.
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

export function sortSubmissions(list: Submission[], sort: SortOption): Submission[] {
  const copy = list.slice();
  if (sort === "recent") {
    copy.sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  } else if (sort === "liked") {
    copy.sort((a, b) => b.likes - a.likes || b.submitted_at.localeCompare(a.submitted_at));
  } else if (sort === "random") {
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
  }
  return copy;
}
