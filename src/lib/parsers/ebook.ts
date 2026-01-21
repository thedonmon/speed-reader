// Unified ebook parser supporting EPUB, MOBI, AZW3/KF8, and FB2 formats
// Uses @lingo-reader packages which share a common interface

import type { ParsedContent, ContentBlock } from '../engine/types';

export type EbookFormat = 'epub' | 'mobi' | 'azw3' | 'fb2';

// Common front matter TOC labels to skip (case-insensitive)
const FRONT_MATTER_PATTERNS = [
  /^copyright/i,
  /^title\s*page/i,
  /^half\s*title/i,
  /^also\s*by/i,
  /^books?\s*by/i,
  /^other\s*books/i,
  /^praise\s*for/i,
  /^advance\s*praise/i,
  /^dedication/i,
  /^epigraph/i,
  /^table\s*of\s*contents/i,
  /^contents/i,
  /^foreword/i,
  /^preface/i,
  /^acknowledgments?/i,
  /^about\s*the\s*author/i,
  /^author'?s?\s*note/i,
  /^editor'?s?\s*note/i,
  /^publisher'?s?\s*note/i,
  /^cover/i,
  /^frontmatter/i,
  /^front\s*matter/i,
];

// Patterns that indicate we've reached actual content
const CONTENT_START_PATTERNS = [
  /^(chapter|part|book|section|prologue|introduction)\s*[0-9ivxlcdm:.\-]*/i,
  /^(one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
  /^[0-9]+\s*[.:]\s*/,  // "1." or "1:" at start
];

/**
 * Check if a TOC label indicates front matter
 */
function isFrontMatter(label: string): boolean {
  const trimmed = label.trim();
  return FRONT_MATTER_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Check if a label indicates the start of main content
 */
function isContentStart(label: string): boolean {
  const trimmed = label.trim();
  return CONTENT_START_PATTERNS.some(pattern => pattern.test(trimmed));
}

// Common interface for all ebook parsers from @lingo-reader
interface EbookParser {
  getSpine: () => { id: string }[];
  loadChapter: (id: string) => Promise<{ html: string } | undefined> | { html: string } | undefined;
  getToc: () => { label: string; href: string; id?: string; children?: unknown[] }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMetadata: () => any;
  getFileInfo: () => { fileName: string };
  getCover?: () => string;
  // EPUB-specific: guide references with type like "text", "toc", "cover"
  getGuide?: () => { title: string; type: string; href: string }[];
  destroy: () => void;
}

/**
 * Detect ebook format from file extension
 */
export function detectEbookFormat(file: File): EbookFormat | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'epub':
      return 'epub';
    case 'mobi':
      return 'mobi';
    case 'azw3':
    case 'azw':
    case 'kf8':
      return 'azw3';
    case 'fb2':
      return 'fb2';
    default:
      return null;
  }
}

/**
 * Check if a file is a supported ebook format
 */
export function isEbookFile(file: File): boolean {
  return detectEbookFormat(file) !== null;
}

/**
 * Get the appropriate parser for an ebook file
 */
async function getParser(file: File): Promise<EbookParser> {
  const format = detectEbookFormat(file);
  
  if (!format) {
    throw new Error(`Unsupported ebook format: ${file.name}`);
  }

  switch (format) {
    case 'epub': {
      const { initEpubFile } = await import('@lingo-reader/epub-parser');
      return await initEpubFile(file);
    }
    case 'mobi': {
      const { initMobiFile } = await import('@lingo-reader/mobi-parser');
      return await initMobiFile(file);
    }
    case 'azw3': {
      const { initKf8File } = await import('@lingo-reader/mobi-parser');
      return await initKf8File(file);
    }
    case 'fb2': {
      const { initFb2File } = await import('@lingo-reader/fb2-parser');
      return await initFb2File(file);
    }
  }
}

/**
 * Find the index of the first content chapter (skipping front matter)
 * Uses guide (EPUB), TOC labels, and heuristics to detect where main content starts
 */
function findContentStartIndex(
  toc: { label: string; href: string; id?: string }[],
  spine: { id: string }[],
  guide?: { title: string; type: string; href: string }[]
): number {
  // Method 1: Check EPUB guide for "text" type (indicates start of main content)
  if (guide && guide.length > 0) {
    const textGuide = guide.find(g => g.type === 'text' || g.type === 'bodymatter');
    if (textGuide) {
      const href = textGuide.href.split('#')[0];
      const spineIndex = spine.findIndex(s => 
        s.id === href || s.id.includes(href) || href.includes(s.id)
      );
      if (spineIndex >= 0) return spineIndex;
    }
  }
  
  // Method 2: Use TOC to find first content chapter
  if (toc && toc.length > 0) {
    for (let i = 0; i < toc.length; i++) {
      const label = toc[i].label;
      const tocId = toc[i].id;
      
      // If it's explicitly content (Chapter 1, Prologue, etc.), start here
      if (isContentStart(label)) {
        // Try to match by id first (more reliable)
        if (tocId) {
          const spineIndex = spine.findIndex(s => s.id === tocId);
          if (spineIndex >= 0) return spineIndex;
        }
        // Fall back to href matching
        const href = toc[i].href.split('#')[0];
        const spineIndex = spine.findIndex(s => 
          s.id === href || s.id.includes(href) || href.includes(s.id)
        );
        if (spineIndex >= 0) return spineIndex;
      }
      
      // If it's not front matter, it might be content
      if (!isFrontMatter(label)) {
        // Check if the next few entries are also not front matter (heuristic)
        const nextFewAreContent = toc.slice(i, i + 3).every(t => !isFrontMatter(t.label));
        if (nextFewAreContent) {
          if (tocId) {
            const spineIndex = spine.findIndex(s => s.id === tocId);
            if (spineIndex >= 0) return spineIndex;
          }
          const href = toc[i].href.split('#')[0];
          const spineIndex = spine.findIndex(s => 
            s.id === href || s.id.includes(href) || href.includes(s.id)
          );
          if (spineIndex >= 0) return spineIndex;
        }
      }
    }
  }
  
  // Fallback: start from beginning
  return 0;
}

/**
 * Parse an ebook file and extract structured content
 * Supports EPUB, MOBI, AZW3/KF8, and FB2 formats
 */
export async function parseEbookFile(file: File): Promise<ParsedContent> {
  const parser = await getParser(file);
  
  try {
    const spine = parser.getSpine();
    const metadata = parser.getMetadata();
    const toc = parser.getToc();
    // Get guide if available (EPUB-specific, helps identify content start)
    const guide = parser.getGuide?.();
    
    const blocks: ContentBlock[] = [];
    
    // Add title as heading if available
    if (metadata.title) {
      blocks.push({
        type: 'heading',
        content: String(metadata.title),
        metadata: { level: 1 },
      });
    }
    
    // Find where actual content starts (skip front matter)
    const startIndex = findContentStartIndex(toc, spine, guide);
    
    // Process each chapter starting from content
    for (let i = startIndex; i < spine.length; i++) {
      const spineItem = spine[i];
      // loadChapter is async for EPUB, sync for MOBI/FB2
      // Using Promise.resolve() handles both cases
      const chapter = await Promise.resolve(parser.loadChapter(spineItem.id));
      
      if (!chapter?.html) continue;
      
      // Parse HTML to extract text content
      const chapterBlocks = parseHtmlToBlocks(chapter.html);
      blocks.push(...chapterBlocks);
      
      // Add paragraph break between chapters
      blocks.push({
        type: 'hr',
        content: '',
      });
    }
    
    // Remove trailing hr
    if (blocks.length > 0 && blocks[blocks.length - 1].type === 'hr') {
      blocks.pop();
    }
    
    return {
      blocks,
      title: metadata.title ? String(metadata.title) : parser.getFileInfo().fileName,
      source: parser.getFileInfo().fileName,
    };
  } finally {
    parser.destroy();
  }
}

/**
 * Extract plain text from an ebook for speed reading
 */
export async function extractEbookText(file: File): Promise<string> {
  const content = await parseEbookFile(file);
  
  return content.blocks
    .filter(b => b.type === 'text' || b.type === 'heading' || b.type === 'blockquote')
    .map(b => {
      if (b.type === 'heading') {
        return '\n\n' + b.content + '\n\n';
      }
      return b.content;
    })
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parse HTML content into content blocks
 * Strips tags and extracts structured content
 */
function parseHtmlToBlocks(html: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  
  // Use DOMParser if available (browser), otherwise basic regex
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    
    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          // Append to last text block or create new one
          const lastBlock = blocks[blocks.length - 1];
          if (lastBlock && lastBlock.type === 'text') {
            lastBlock.content += ' ' + text;
          } else {
            blocks.push({ type: 'text', content: text });
          }
        }
        return;
      }
      
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      
      // Handle different element types
      switch (tagName) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6': {
          const level = parseInt(tagName[1]);
          const text = element.textContent?.trim();
          if (text) {
            blocks.push({
              type: 'heading',
              content: text,
              metadata: { level },
            });
          }
          break;
        }
        
        case 'pre':
        case 'code': {
          const code = element.textContent?.trim();
          if (code) {
            blocks.push({
              type: 'code',
              content: code,
              metadata: { language: element.getAttribute('class')?.replace('language-', '') },
            });
          }
          break;
        }
        
        case 'blockquote': {
          const text = element.textContent?.trim();
          if (text) {
            blocks.push({ type: 'blockquote', content: text });
          }
          break;
        }
        
        case 'img': {
          const src = element.getAttribute('src');
          const alt = element.getAttribute('alt');
          if (src) {
            blocks.push({
              type: 'image',
              content: alt || 'Image',
              metadata: { src, alt: alt || undefined },
            });
          }
          break;
        }
        
        case 'hr': {
          blocks.push({ type: 'hr', content: '' });
          break;
        }
        
        case 'p':
        case 'div': {
          // Process children
          for (const child of Array.from(element.childNodes)) {
            processNode(child);
          }
          // Add paragraph break
          const lastBlock = blocks[blocks.length - 1];
          if (lastBlock && lastBlock.type === 'text' && lastBlock.content) {
            lastBlock.content = lastBlock.content.trim() + '\n\n';
          }
          break;
        }
        
        case 'br': {
          const lastBlock = blocks[blocks.length - 1];
          if (lastBlock && lastBlock.type === 'text') {
            lastBlock.content += '\n';
          }
          break;
        }
        
        case 'ul':
        case 'ol': {
          const items: string[] = [];
          element.querySelectorAll('li').forEach((li, i) => {
            const prefix = tagName === 'ol' ? `${i + 1}. ` : '- ';
            items.push(prefix + (li.textContent?.trim() || ''));
          });
          if (items.length > 0) {
            blocks.push({
              type: 'list',
              content: items.join('\n'),
              metadata: { ordered: tagName === 'ol' },
            });
          }
          break;
        }
        
        default: {
          // Process children for other elements
          for (const child of Array.from(element.childNodes)) {
            processNode(child);
          }
        }
      }
    };
    
    processNode(doc.body.firstChild!);
  } else {
    // Server-side fallback: basic HTML stripping
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    
    if (text) {
      blocks.push({ type: 'text', content: text });
    }
  }
  
  // Clean up empty blocks and normalize
  return blocks
    .filter(b => b.content.trim() || b.type === 'hr')
    .map(b => ({
      ...b,
      content: b.content.trim(),
    }));
}

/**
 * Get supported ebook file extensions
 */
export function getSupportedEbookExtensions(): string[] {
  return ['.epub', '.mobi', '.azw3', '.azw', '.kf8', '.fb2'];
}
