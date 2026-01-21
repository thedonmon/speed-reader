// Unified ebook parser supporting EPUB, MOBI, AZW3/KF8, and FB2 formats
// Uses @lingo-reader packages which share a common interface

import type { ParsedContent, ContentBlock } from '../engine/types';

export type EbookFormat = 'epub' | 'mobi' | 'azw3' | 'fb2';

// Common interface for all ebook parsers from @lingo-reader
interface EbookParser {
  getSpine: () => { id: string }[];
  loadChapter: (id: string) => Promise<{ html: string } | undefined> | { html: string } | undefined;
  getToc: () => { label: string; href: string; children?: unknown[] }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMetadata: () => any;
  getFileInfo: () => { fileName: string };
  getCover?: () => string;
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
 * Parse an ebook file and extract structured content
 * Supports EPUB, MOBI, AZW3/KF8, and FB2 formats
 */
export async function parseEbookFile(file: File): Promise<ParsedContent> {
  const parser = await getParser(file);
  
  try {
    const spine = parser.getSpine();
    const metadata = parser.getMetadata();
    
    const blocks: ContentBlock[] = [];
    
    // Add title as heading if available
    if (metadata.title) {
      blocks.push({
        type: 'heading',
        content: String(metadata.title),
        metadata: { level: 1 },
      });
    }
    
    // Process each chapter
    for (const spineItem of spine) {
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
