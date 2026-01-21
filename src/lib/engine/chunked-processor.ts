// Chunked text processing for large documents
// Processes text in chunks to avoid memory issues and provide faster initial load

import type { TextSlide, ReaderSettings, SlideShowData } from './types';
import { tokenizeText } from './tokenizer';
import { applyTiming, calculateSlideShowData } from './timing';

// Default chunk size in characters
const DEFAULT_CHUNK_SIZE = 10000; // ~2000 words
const SLIDE_BUFFER_SIZE = 500; // Keep 500 slides in memory around current position

export interface ChunkedProcessor {
  // Total estimated slides (may update as we process)
  totalEstimatedSlides: number;
  // Actually processed slides count
  processedSlidesCount: number;
  // Get slides for a range (will process on-demand if needed)
  getSlides: (startIndex: number, count: number) => TextSlide[];
  // Get a single slide
  getSlide: (index: number) => TextSlide | null;
  // Get current stats
  getStats: () => SlideShowData;
  // Check if fully processed
  isFullyProcessed: boolean;
  // Process more chunks (returns true if more to process)
  processMore: () => boolean;
  // Process all remaining (for small texts)
  processAll: () => void;
}

interface TextChunk {
  startChar: number;
  endChar: number;
  text: string;
  processed: boolean;
  slides: TextSlide[];
  slideStartIndex: number;
}

/**
 * Create a chunked processor for large texts
 * This allows for:
 * - Fast initial load (only process first chunk)
 * - On-demand processing as user reads
 * - Memory efficiency (can drop processed chunks if needed)
 */
export function createChunkedProcessor(
  text: string,
  settings: ReaderSettings,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): ChunkedProcessor {
  // Split text into chunks at word boundaries
  const chunks: TextChunk[] = [];
  let charIndex = 0;
  
  while (charIndex < text.length) {
    let endIndex = Math.min(charIndex + chunkSize, text.length);
    
    // Find word boundary (don't split mid-word)
    if (endIndex < text.length) {
      // Look for space, newline, or punctuation
      while (endIndex > charIndex && !/\s/.test(text[endIndex])) {
        endIndex--;
      }
      // If we couldn't find a boundary, just use the chunk size
      if (endIndex === charIndex) {
        endIndex = Math.min(charIndex + chunkSize, text.length);
      }
    }
    
    chunks.push({
      startChar: charIndex,
      endChar: endIndex,
      text: text.slice(charIndex, endIndex),
      processed: false,
      slides: [],
      slideStartIndex: 0,
    });
    
    charIndex = endIndex;
  }
  
  // For small texts, just process everything
  const isSmallText = chunks.length <= 2;
  
  // Track all slides and their chunk mapping
  let allSlides: TextSlide[] = [];
  let totalProcessedSlides = 0;
  let currentChunkIndex = 0;
  
  // Estimate total slides based on word count
  const wordCount = text.split(/\s+/).length;
  let estimatedTotalSlides = Math.ceil(wordCount / settings.chunkSize);
  
  // Process a single chunk
  function processChunk(chunkIndex: number): void {
    if (chunkIndex < 0 || chunkIndex >= chunks.length) return;
    
    const chunk = chunks[chunkIndex];
    if (chunk.processed) return;
    
    // Tokenize this chunk
    const chunkSlides = tokenizeText(chunk.text, settings);
    applyTiming(chunkSlides, settings);
    
    // Update slide numbers to be global
    chunk.slideStartIndex = totalProcessedSlides;
    for (let i = 0; i < chunkSlides.length; i++) {
      chunkSlides[i].slideNumber = totalProcessedSlides + i + 1;
    }
    
    chunk.slides = chunkSlides;
    chunk.processed = true;
    totalProcessedSlides += chunkSlides.length;
    
    // Rebuild allSlides array
    rebuildSlidesArray();
  }
  
  // Rebuild the slides array from processed chunks
  function rebuildSlidesArray(): void {
    allSlides = [];
    for (const chunk of chunks) {
      if (chunk.processed) {
        allSlides.push(...chunk.slides);
      }
    }
  }
  
  // Process initial chunk(s)
  if (isSmallText) {
    // Small text - process everything
    for (let i = 0; i < chunks.length; i++) {
      processChunk(i);
    }
    currentChunkIndex = chunks.length;
  } else {
    // Large text - just process first chunk
    processChunk(0);
    currentChunkIndex = 1;
  }
  
  // Update estimate based on first chunk
  if (chunks.length > 0 && chunks[0].processed) {
    const avgSlidesPerChar = chunks[0].slides.length / (chunks[0].endChar - chunks[0].startChar);
    estimatedTotalSlides = Math.ceil(text.length * avgSlidesPerChar);
  }
  
  return {
    get totalEstimatedSlides() {
      return chunks.every(c => c.processed) ? allSlides.length : estimatedTotalSlides;
    },
    
    get processedSlidesCount() {
      return allSlides.length;
    },
    
    get isFullyProcessed() {
      return chunks.every(c => c.processed);
    },
    
    getSlides(startIndex: number, count: number): TextSlide[] {
      // Ensure chunks are processed for this range
      ensureSlidesProcessed(startIndex, count);
      return allSlides.slice(startIndex, startIndex + count);
    },
    
    getSlide(index: number): TextSlide | null {
      ensureSlidesProcessed(index, 1);
      return allSlides[index] || null;
    },
    
    getStats(): SlideShowData {
      return calculateSlideShowData(allSlides, settings);
    },
    
    processMore(): boolean {
      if (currentChunkIndex >= chunks.length) {
        return false;
      }
      processChunk(currentChunkIndex);
      currentChunkIndex++;
      return currentChunkIndex < chunks.length;
    },
    
    processAll(): void {
      while (currentChunkIndex < chunks.length) {
        processChunk(currentChunkIndex);
        currentChunkIndex++;
      }
    },
  };
  
  // Helper to ensure slides are processed for a given range
  function ensureSlidesProcessed(startIndex: number, count: number): void {
    const endIndex = startIndex + count;
    
    // Find which chunks need to be processed
    let slideCount = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      if (chunk.processed) {
        slideCount += chunk.slides.length;
        continue;
      }
      
      // Estimate if this chunk might contain needed slides
      const estimatedChunkSlides = Math.ceil(
        (chunk.endChar - chunk.startChar) * (allSlides.length / (chunks[0]?.endChar || 1))
      ) || 100;
      
      if (slideCount + estimatedChunkSlides >= startIndex && slideCount < endIndex) {
        processChunk(i);
        slideCount += chunk.slides.length;
      } else {
        slideCount += estimatedChunkSlides;
      }
      
      // Stop if we've processed enough
      if (slideCount > endIndex + SLIDE_BUFFER_SIZE) {
        break;
      }
    }
  }
}

/**
 * Estimate reading time for text without full processing
 */
export function estimateReadingTime(
  text: string,
  wpm: number
): { words: number; minutes: number; seconds: number } {
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const totalSeconds = (words / wpm) * 60;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  
  return { words, minutes, seconds };
}

/**
 * Split text into logical sections (paragraphs, chapters)
 * Useful for progress indication and navigation
 */
export function splitIntoSections(text: string): { start: number; end: number; preview: string }[] {
  const sections: { start: number; end: number; preview: string }[] = [];
  
  // Split by double newlines (paragraphs)
  const paragraphRegex = /\n\s*\n/g;
  let lastEnd = 0;
  let match;
  
  while ((match = paragraphRegex.exec(text)) !== null) {
    if (match.index > lastEnd) {
      const sectionText = text.slice(lastEnd, match.index);
      sections.push({
        start: lastEnd,
        end: match.index,
        preview: sectionText.slice(0, 100).trim() + (sectionText.length > 100 ? '...' : ''),
      });
    }
    lastEnd = match.index + match[0].length;
  }
  
  // Add final section
  if (lastEnd < text.length) {
    const sectionText = text.slice(lastEnd);
    sections.push({
      start: lastEnd,
      end: text.length,
      preview: sectionText.slice(0, 100).trim() + (sectionText.length > 100 ? '...' : ''),
    });
  }
  
  return sections;
}
