// Reading progress storage using localStorage
// Saves and restores reading position per document

const STORAGE_KEY = 'speed-reader-progress';
const MAX_ENTRIES = 50; // Keep last 50 documents

export interface ReadingProgress {
  /** Unique identifier for the document (hash of content) */
  id: string;
  /** Document title */
  title: string;
  /** Current slide index */
  position: number;
  /** Total slides (for progress display) */
  totalSlides: number;
  /** WPM setting used */
  wpm: number;
  /** Last read timestamp */
  lastRead: number;
  /** Progress percentage (0-100) */
  progress: number;
}

interface ProgressStorage {
  entries: Record<string, ReadingProgress>;
}

/**
 * Generate a simple hash from content for identification
 * Uses first 1000 chars + last 1000 chars + length for uniqueness
 */
export function generateContentId(content: string, title?: string): string {
  const prefix = content.slice(0, 1000);
  const suffix = content.slice(-1000);
  const combined = `${title || ''}:${content.length}:${prefix}:${suffix}`;
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Get all stored progress entries
 */
function getStorage(): ProgressStorage {
  if (typeof window === 'undefined') {
    return { entries: {} };
  }
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to read progress storage:', e);
  }
  
  return { entries: {} };
}

/**
 * Save storage to localStorage
 */
function setStorage(storage: ProgressStorage): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch (e) {
    console.error('Failed to save progress storage:', e);
  }
}

/**
 * Clean up old entries if we have too many
 */
function pruneOldEntries(storage: ProgressStorage): void {
  const entries = Object.values(storage.entries);
  
  if (entries.length <= MAX_ENTRIES) return;
  
  // Sort by lastRead, oldest first
  entries.sort((a, b) => a.lastRead - b.lastRead);
  
  // Remove oldest entries
  const toRemove = entries.slice(0, entries.length - MAX_ENTRIES);
  for (const entry of toRemove) {
    delete storage.entries[entry.id];
  }
}

/**
 * Save reading progress for a document
 */
export function saveProgress(
  contentId: string,
  title: string,
  position: number,
  totalSlides: number,
  wpm: number
): void {
  const storage = getStorage();
  
  const progress = totalSlides > 0 ? Math.round((position / totalSlides) * 100) : 0;
  
  storage.entries[contentId] = {
    id: contentId,
    title,
    position,
    totalSlides,
    wpm,
    lastRead: Date.now(),
    progress,
  };
  
  pruneOldEntries(storage);
  setStorage(storage);
}

/**
 * Get saved progress for a document
 */
export function getProgress(contentId: string): ReadingProgress | null {
  const storage = getStorage();
  return storage.entries[contentId] || null;
}

/**
 * Delete progress for a document
 */
export function deleteProgress(contentId: string): void {
  const storage = getStorage();
  delete storage.entries[contentId];
  setStorage(storage);
}

/**
 * Get all saved progress entries, sorted by lastRead (most recent first)
 */
export function getAllProgress(): ReadingProgress[] {
  const storage = getStorage();
  return Object.values(storage.entries).sort((a, b) => b.lastRead - a.lastRead);
}

/**
 * Clear all saved progress
 */
export function clearAllProgress(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear progress storage:', e);
  }
}

/**
 * Format relative time (e.g., "2 hours ago", "yesterday")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
}
