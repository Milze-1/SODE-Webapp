export interface BibleBook { name: string; chapters: number; }

export const OLD_TESTAMENT: BibleBook[] = [
  { name: 'Genesis', chapters: 50 },
  { name: 'Exodus', chapters: 40 },
  { name: 'Leviticus', chapters: 27 },
  { name: 'Numbers', chapters: 36 },
  { name: 'Deuteronomy', chapters: 34 },
  { name: 'Joshua', chapters: 24 },
  { name: 'Judges', chapters: 21 },
  { name: 'Ruth', chapters: 4 },
  { name: '1 Samuel', chapters: 31 },
  { name: '2 Samuel', chapters: 24 },
  { name: '1 Kings', chapters: 22 },
  { name: '2 Kings', chapters: 25 },
  { name: '1 Chronicles', chapters: 29 },
  { name: '2 Chronicles', chapters: 36 },
  { name: 'Ezra', chapters: 10 },
  { name: 'Nehemiah', chapters: 13 },
  { name: 'Esther', chapters: 10 },
  { name: 'Job', chapters: 42 },
  { name: 'Psalms', chapters: 150 },
  { name: 'Proverbs', chapters: 31 },
  { name: 'Ecclesiastes', chapters: 12 },
  { name: 'Song of Solomon', chapters: 8 },
  { name: 'Isaiah', chapters: 66 },
  { name: 'Jeremiah', chapters: 52 },
  { name: 'Lamentations', chapters: 5 },
  { name: 'Ezekiel', chapters: 48 },
  { name: 'Daniel', chapters: 12 },
  { name: 'Hosea', chapters: 14 },
  { name: 'Joel', chapters: 3 },
  { name: 'Amos', chapters: 9 },
  { name: 'Obadiah', chapters: 1 },
  { name: 'Jonah', chapters: 4 },
  { name: 'Micah', chapters: 7 },
  { name: 'Nahum', chapters: 3 },
  { name: 'Habakkuk', chapters: 3 },
  { name: 'Zephaniah', chapters: 3 },
  { name: 'Haggai', chapters: 2 },
  { name: 'Zechariah', chapters: 14 },
  { name: 'Malachi', chapters: 4 },
];

export const NEW_TESTAMENT: BibleBook[] = [
  { name: 'Matthew', chapters: 28 },
  { name: 'Mark', chapters: 16 },
  { name: 'Luke', chapters: 24 },
  { name: 'John', chapters: 21 },
  { name: 'Acts', chapters: 28 },
  { name: 'Romans', chapters: 16 },
  { name: '1 Corinthians', chapters: 16 },
  { name: '2 Corinthians', chapters: 13 },
  { name: 'Galatians', chapters: 6 },
  { name: 'Ephesians', chapters: 6 },
  { name: 'Philippians', chapters: 4 },
  { name: 'Colossians', chapters: 4 },
  { name: '1 Thessalonians', chapters: 5 },
  { name: '2 Thessalonians', chapters: 3 },
  { name: '1 Timothy', chapters: 6 },
  { name: '2 Timothy', chapters: 4 },
  { name: 'Titus', chapters: 3 },
  { name: 'Philemon', chapters: 1 },
  { name: 'Hebrews', chapters: 13 },
  { name: 'James', chapters: 5 },
  { name: '1 Peter', chapters: 5 },
  { name: '2 Peter', chapters: 3 },
  { name: '1 John', chapters: 5 },
  { name: '2 John', chapters: 1 },
  { name: '3 John', chapters: 1 },
  { name: 'Jude', chapters: 1 },
  { name: 'Revelation', chapters: 22 },
];

export const ALL_BOOKS = [...OLD_TESTAMENT, ...NEW_TESTAMENT];

// start_book / end_book were dropped from the bible_reading_plans table.
// They remain optional here for backward compatibility: when absent, a plan
// spans the full testament range.
export interface BibleReadingPlanRow {
  id: string;
  member_id: string | null;
  devotion_plan_id: string | null;
  testament: 'old' | 'new' | 'both';
  start_book?: string | null;
  end_book?: string | null;
  chapters_per_day: number;
  start_date: string;
  created_at: string;
}

export interface DayPassage {
  bookName: string;
  startChapter: number;
  endChapter: number;
  apiQuery: string;
  displayText: string;
}

function booksForTestament(testament: 'old' | 'new' | 'both'): BibleBook[] {
  return testament === 'old' ? OLD_TESTAMENT : testament === 'new' ? NEW_TESTAMENT : ALL_BOOKS;
}

function getBooksInRange(testament: 'old' | 'new' | 'both', startBook?: string | null, endBook?: string | null): BibleBook[] {
  const pool = booksForTestament(testament);
  if (!startBook || !endBook) return pool;
  const si = pool.findIndex(b => b.name === startBook);
  const ei = pool.findIndex(b => b.name === endBook);
  if (si === -1 || ei === -1) return pool;
  return pool.slice(si, Math.max(si, ei) + 1);
}

export function getTotalChapters(testament: 'old' | 'new' | 'both', startBook?: string | null, endBook?: string | null): number {
  return getBooksInRange(testament, startBook, endBook).reduce((s, b) => s + b.chapters, 0);
}

export function getTotalDays(plan: BibleReadingPlanRow): number {
  const total = getTotalChapters(plan.testament, plan.start_book, plan.end_book);
  return Math.ceil(total / Math.max(1, plan.chapters_per_day));
}

export function getDayNumber(startDate: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86400000) + 1);
}

export function getDayPassage(plan: BibleReadingPlanRow, dayNumber: number): DayPassage | null {
  const books = getBooksInRange(plan.testament, plan.start_book, plan.end_book);
  if (!books.length) return null;
  const cpd = Math.max(1, plan.chapters_per_day);
  const totalChapters = books.reduce((s, b) => s + b.chapters, 0);
  const totalDays = Math.ceil(totalChapters / cpd);

  const clampedDay = Math.min(dayNumber, totalDays);
  const startIdx = (clampedDay - 1) * cpd; // 0-based absolute chapter index

  let cursor = 0;
  for (const book of books) {
    if (startIdx < cursor + book.chapters) {
      const chapterInBook = startIdx - cursor + 1;
      const chaptersThisDay = Math.min(cpd, book.chapters - chapterInBook + 1);
      const endChapter = chapterInBook + chaptersThisDay - 1;
      const displayText = endChapter > chapterInBook
        ? `${book.name} ${chapterInBook}–${endChapter}`
        : `${book.name} ${chapterInBook}`;
      const apiQuery = endChapter > chapterInBook
        ? `${book.name} ${chapterInBook}-${endChapter}`
        : `${book.name} ${chapterInBook}`;
      return { bookName: book.name, startChapter: chapterInBook, endChapter, apiQuery, displayText };
    }
    cursor += book.chapters;
  }
  return null;
}

export function getPlanProgress(plan: BibleReadingPlanRow, dayNumber: number): { daysCompleted: number; totalDays: number; pct: number } {
  const totalDays = getTotalDays(plan);
  const daysCompleted = Math.min(dayNumber - 1, totalDays);
  return { daysCompleted, totalDays, pct: totalDays > 0 ? daysCompleted / totalDays : 0 };
}
