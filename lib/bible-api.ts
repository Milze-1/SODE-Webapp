export interface BibleVerse {
  book_id: string;
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface BiblePassage {
  reference: string;
  verses: BibleVerse[];
  text: string;
  translation_id: string;
  translation_name: string;
}

// Server-side only — uses Next.js fetch cache (24h)
export async function fetchPassage(query: string, translation = 'web'): Promise<BiblePassage | null> {
  try {
    const url = `https://bible-api.com/${encodeURIComponent(query)}?translation=${translation}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = (await res.json()) as BiblePassage & { error?: string };
    if ('error' in data && data.error) return null;
    return data;
  } catch {
    return null;
  }
}

export function bibleGatewayUrl(query: string): string {
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(query)}&version=WEB`;
}
