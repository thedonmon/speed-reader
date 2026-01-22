// Speed Reading Engine - Main export
// Combines tokenization, timing, and ORP calculation

export * from './types';
export * from './tokenizer';
export * from './timing';
export { getWordInformation } from './word-frequency';

import type { TextSlide, ReaderSettings, SlideShowData, ParsedContent, ContentBlock } from './types';
import { tokenizeText, calculateORP, calculatePixelOffset } from './tokenizer';
import { applyTiming, calculateSlideShowData } from './timing';

/**
 * Process text into ready-to-display slides
 * This is the main entry point for the engine
 */
export function processText(
  text: string,
  settings: ReaderSettings
): { slides: TextSlide[]; stats: SlideShowData } {
  // Tokenize the text
  const slides = tokenizeText(text, settings);
  
  // Apply timing algorithm
  applyTiming(slides, settings);
  
  // Calculate statistics
  const stats = calculateSlideShowData(slides, settings);
  
  return { slides, stats };
}

/**
 * Process structured content (markdown, etc.) into slides
 * Handles different content types appropriately:
 * - text: normal RSVP processing
 * - code: single slide with full content (pause)
 * - table: single slide with full table (pause)
 * - heading: single slide with pause
 * - etc.
 */
export function processContent(
  content: ParsedContent,
  settings: ReaderSettings
): { slides: TextSlide[]; stats: SlideShowData; blockIndices: number[] } {
  const allSlides: TextSlide[] = [];
  const blockIndices: number[] = []; // Track where each block starts
  
  for (const block of content.blocks) {
    blockIndices.push(allSlides.length);
    
    switch (block.type) {
      case 'code':
        // Code blocks: single slide, shown with pause
        allSlides.push(createBlockSlide(block, settings, 'code'));
        break;
        
      case 'table':
        // Tables: single slide, shown with pause
        allSlides.push(createBlockSlide(block, settings, 'table'));
        break;
        
      case 'heading':
        // Headings: single slide with emphasis
        allSlides.push(createBlockSlide(block, settings, 'heading'));
        break;
        
      case 'image':
        // Images: single slide for display
        allSlides.push(createBlockSlide(block, settings, 'image'));
        break;
        
      case 'hr':
        // Horizontal rules are visual separators - skip them entirely in RSVP
        break;
        
      case 'blockquote':
        // Blockquotes: process as text but with styling flag
        const bqResult = processText(block.content, settings);
        for (const slide of bqResult.slides) {
          (slide as TextSlide & { blockType?: string }).blockType = 'blockquote';
        }
        allSlides.push(...bqResult.slides);
        break;
        
      case 'list':
        // Lists: process as text but with list styling flag
        const listResult = processText(block.content, settings);
        for (const slide of listResult.slides) {
          (slide as TextSlide & { blockType?: string; metadata?: ContentBlock['metadata'] }).blockType = 'list';
          (slide as TextSlide & { metadata?: ContentBlock['metadata'] }).metadata = block.metadata;
        }
        allSlides.push(...listResult.slides);
        break;
        
      case 'text':
      default:
        // Regular text: full RSVP processing
        const result = processText(block.content, settings);
        allSlides.push(...result.slides);
        break;
    }
  }
  
  const stats = calculateSlideShowData(allSlides, settings);
  
  return { slides: allSlides, stats, blockIndices };
}

/**
 * Create a special slide for non-text blocks (code, images, tables, etc.)
 */
function createBlockSlide(
  block: ContentBlock,
  settings: ReaderSettings,
  type: 'code' | 'heading' | 'image' | 'table'
): TextSlide & { blockType: string; metadata?: ContentBlock['metadata'] } {
  // Different pause durations for different block types
  // Duration scales with content length for code and tables
  const baseLineDuration = 500; // 0.5s per line of code/table
  const lineCount = block.content.split('\n').length;
  
  const pauseDurations: Record<string, number> = {
    code: Math.max(3000, Math.min(15000, lineCount * baseLineDuration)), // 3-15 seconds based on lines
    table: Math.max(3000, Math.min(15000, lineCount * baseLineDuration)), // 3-15 seconds based on rows
    heading: 1500, // 1.5 seconds for headings
    image: 3000,   // 3 seconds for images
  };
  
  return {
    text: block.content,
    textOriginal: block.content,
    duration: pauseDurations[type] || 1000,
    preDelay: 0,
    postDelay: settings.pauseAfterParagraphDelay,
    wpm: settings.wpm,
    optimalLetterPosition: 1,
    pixelOffset: 0,
    slideNumber: 0, // Will be set properly during final processing
    wordsInSlide: block.content.split(/\s+/).length,
    isChildOfPrevious: false,
    hasBeenReversed: false,
    blockType: type,
    metadata: block.metadata,
  };
}

/**
 * Recalculate pixel offsets for all slides
 * Useful when font or fontSize changes
 */
export function recalculatePixelOffsets(
  slides: TextSlide[],
  font: string,
  fontSize: number
): void {
  for (const slide of slides) {
    slide.pixelOffset = calculatePixelOffset(
      slide.text,
      slide.optimalLetterPosition,
      font,
      fontSize
    );
  }
}
