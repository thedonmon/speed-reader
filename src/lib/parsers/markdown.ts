// Markdown parser for speed reader
// Uses streamdown's parseMarkdownIntoBlocks and identifies block types
// Code blocks, tables are displayed as full blocks (using Streamdown to render)
// Regular text is RSVP'd word by word

import { parseMarkdownIntoBlocks } from 'streamdown';
import type { ParsedContent, ContentBlock, ContentBlockType } from '../engine/types';

// TODO: Remove this workaround once streamdown releases the fix
// WORKAROUND: streamdown's footnote detection regex incorrectly matches [^ patterns
// inside code blocks (e.g., regex like [^\s...]). We escape these before parsing
// and restore them after. Fix submitted: https://github.com/vercel/streamdown/pull/365
// Once merged, delete: CARET_BRACKET_PLACEHOLDER, escapeCodeBlockPatterns,
// restoreCodeBlockPatterns, and their usage in parseMarkdown()
const CARET_BRACKET_PLACEHOLDER = '\u0000CARET_BRACKET\u0000';

/**
 * Escape [^ patterns inside fenced code blocks to prevent streamdown's
 * footnote detection from incorrectly matching them
 */
function escapeCodeBlockPatterns(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;
  
  for (const line of lines) {
    // Check for fenced code block delimiter
    if (/^```/.test(line.trim()) || /^~~~/.test(line.trim())) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }
    
    // If inside a code block, escape [^ patterns
    if (inCodeBlock && line.includes('[^')) {
      result.push(line.replace(/\[\^/g, CARET_BRACKET_PLACEHOLDER));
    } else {
      result.push(line);
    }
  }
  
  return result.join('\n');
}

/**
 * Restore escaped [^ patterns
 */
function restoreCodeBlockPatterns(text: string): string {
  return text.replace(new RegExp(CARET_BRACKET_PLACEHOLDER, 'g'), '[^');
}

/**
 * Identify the type of a markdown block
 */
function identifyBlockType(block: string): { type: ContentBlockType; metadata?: ContentBlock['metadata'] } {
  const trimmed = block.trim();
  
  // Fenced code block
  if (/^```/.test(trimmed)) {
    const langMatch = trimmed.match(/^```(\w*)/);
    return { 
      type: 'code', 
      metadata: { language: langMatch?.[1] || undefined }
    };
  }
  
  // Indented code block (4 spaces or tab at start of all lines)
  if (/^(?:    |\t)/.test(trimmed) && trimmed.split('\n').every(line => !line || /^(?:    |\t)/.test(line))) {
    return { type: 'code' };
  }
  
  // Table detection - supports both with and without leading pipes
  // Format 1: | Col1 | Col2 |  (with leading/trailing pipes)
  // Format 2: Col1 | Col2      (without leading pipes)
  // Both require a separator row with dashes (and optional colons for alignment)
  const lines = trimmed.split('\n').filter(l => l.trim());
  if (lines.length >= 2) {
    const hasColumnSeparators = lines[0].includes('|');
    // Separator row: contains only |, -, :, and whitespace
    const separatorRowRegex = /^[\s|:-]+$/;
    const hasSeparatorRow = lines.some(line => 
      separatorRowRegex.test(line) && line.includes('-') && line.includes('|')
    );
    if (hasColumnSeparators && hasSeparatorRow) {
      return { type: 'table' };
    }
  }
  
  // Heading
  if (/^#{1,6}\s+/.test(trimmed)) {
    const level = trimmed.match(/^(#{1,6})/)?.[1].length || 1;
    return { type: 'heading', metadata: { level } };
  }
  
  // Setext heading (underlined with === or ---)
  if (/^.+\n=+\s*$/.test(trimmed)) {
    return { type: 'heading', metadata: { level: 1 } };
  }
  if (/^.+\n-+\s*$/.test(trimmed)) {
    return { type: 'heading', metadata: { level: 2 } };
  }
  
  // Blockquote
  if (/^>/.test(trimmed)) {
    return { type: 'blockquote' };
  }
  
  // Horizontal rule
  if (/^([\*\-_]){3,}\s*$/.test(trimmed)) {
    return { type: 'hr' };
  }
  
  // Image (standalone)
  if (/^!\[.*\]\(.*\)\s*$/.test(trimmed)) {
    const match = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    return { 
      type: 'image', 
      metadata: { alt: match?.[1], src: match?.[2] }
    };
  }
  
  // List (ordered or unordered)
  if (/^[\*\-\+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
    const isOrdered = /^\d+\./.test(trimmed);
    return { type: 'list', metadata: { ordered: isOrdered } };
  }
  
  // Default to text
  return { type: 'text' };
}

/**
 * Strip markdown formatting from text for clean RSVP display
 * Converts markdown syntax to plain text
 */
function stripMarkdownFormatting(text: string): string {
  return text
    // Links: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Images: ![alt](url) -> (skip or show alt)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1 ')
    // Bold: **text** or __text__ -> text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Italic: *text* or _text_ -> text
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Strikethrough: ~~text~~ -> text
    .replace(/~~([^~]+)~~/g, '$1')
    // Inline code: `code` -> code
    .replace(/`([^`]+)`/g, '$1')
    // Reference-style links: [text][ref] -> text
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    // Autolinks: <url> -> url
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    // HTML tags
    .replace(/<[^>]+>/g, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract clean content from a markdown block
 */
function extractContent(block: string, type: ContentBlockType): string {
  const trimmed = block.trim();
  
  switch (type) {
    case 'code':
      // Keep the full markdown for Streamdown to render
      return trimmed;
      
    case 'table':
      // Keep full table markdown for Streamdown
      return trimmed;
      
    case 'heading':
      // Remove # prefix and strip markdown formatting for RSVP display
      const headingText = trimmed.replace(/^#+\s*/, '');
      return stripMarkdownFormatting(headingText);
      
    case 'blockquote':
      // Remove > prefix and strip formatting
      const quoteText = trimmed.replace(/^>\s*/gm, '');
      return stripMarkdownFormatting(quoteText);
      
    case 'image':
      // For standalone images, just extract alt text
      const altMatch = trimmed.match(/!\[([^\]]*)\]/);
      return altMatch?.[1] || '';
      
    case 'list':
      // Strip formatting from list items
      return stripMarkdownFormatting(trimmed);
      
    case 'hr':
      return '---';
      
    default:
      // Regular text - strip markdown formatting
      return stripMarkdownFormatting(trimmed);
  }
}

/**
 * Parses markdown text and identifies block types
 * Code blocks and tables are kept whole for rendering
 * Regular text is prepared for RSVP processing
 */
export function parseMarkdown(text: string): ParsedContent {
  // WORKAROUND: Escape [^ patterns in code blocks before parsing
  // to prevent streamdown's footnote detection from matching them
  const escapedText = escapeCodeBlockPatterns(text);
  
  // Use streamdown to split into blocks
  const rawBlocks = parseMarkdownIntoBlocks(escapedText);
  
  const blocks: ContentBlock[] = [];
  
  for (let rawBlock of rawBlocks) {
    if (!rawBlock.trim()) continue;
    
    // Restore escaped patterns
    rawBlock = restoreCodeBlockPatterns(rawBlock);
    
    const { type, metadata } = identifyBlockType(rawBlock);
    const content = extractContent(rawBlock, type);
    
    if (content) {
      blocks.push({ type, content, metadata });
    }
  }
  
  // Extract title from first heading
  const firstHeading = blocks.find(b => b.type === 'heading');
  let title: string | undefined;
  if (firstHeading) {
    // Extract text from heading markdown
    title = firstHeading.content.replace(/^#+\s*/, '').trim();
  }
  
  return { blocks, title };
}

/**
 * Detect if text appears to be markdown
 */
export function isMarkdown(text: string): boolean {
  // Check for common markdown patterns
  const patterns = [
    /^#{1,6}\s+/m,           // Headings
    /^```/m,                  // Code fences
    /^\|.+\|/m,               // Tables
    /^>\s+/m,                 // Blockquotes
    /^[\*\-\+]\s+/m,          // Unordered lists
    /^\d+\.\s+/m,             // Ordered lists
    /\[.+\]\(.+\)/,           // Links
    /!\[.+\]\(.+\)/,          // Images
    /\*\*.+\*\*/,             // Bold
    /__.+__/,                 // Bold alt
    /~~.+~~/,                 // Strikethrough
  ];

  let matchCount = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      matchCount++;
      if (matchCount >= 2) return true; // Need at least 2 matches
    }
  }

  // Code blocks are a strong signal on their own
  if (/^```/m.test(text)) return true;

  return false;
}
