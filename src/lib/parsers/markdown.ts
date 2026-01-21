// Markdown parser for speed reader
// Uses streamdown's parseMarkdownIntoBlocks and identifies block types
// Code blocks, tables are displayed as full blocks (using Streamdown to render)
// Regular text is RSVP'd word by word

import { parseMarkdownIntoBlocks } from 'streamdown';
import type { ParsedContent, ContentBlock, ContentBlockType } from '../engine/types';

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
  
  // Table (has | and separator row with ---)
  if (/^\|.+\|/.test(trimmed) && /\|[\s\-:|]+\|/.test(trimmed)) {
    return { type: 'table' };
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
      // Remove # prefix for RSVP display, but keep markdown for rendering
      return trimmed;
      
    case 'blockquote':
      // Remove > prefix for RSVP, but keep for rendering
      return trimmed;
      
    case 'image':
      // Keep full markdown
      return trimmed;
      
    case 'list':
      // Keep list as-is, but we'll RSVP the text
      return trimmed;
      
    case 'hr':
      return '---';
      
    default:
      return trimmed;
  }
}

/**
 * Parses markdown text using streamdown and identifies block types
 * Code blocks and tables are kept whole for rendering
 * Regular text is prepared for RSVP processing
 */
export function parseMarkdown(text: string): ParsedContent {
  // Use streamdown to split into blocks
  const rawBlocks = parseMarkdownIntoBlocks(text);
  
  const blocks: ContentBlock[] = [];
  
  for (const rawBlock of rawBlocks) {
    if (!rawBlock.trim()) continue;
    
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
