// Text tokenization and processing engine
// Ported from sprint-reader-chrome with TypeScript modernization

import type { TextSlide, ReaderSettings } from './types';

interface FirstPassItem {
  text: string;
  textOriginal: string;
  slideNumber: number;
  isChildOfPrevious: boolean;
}

/**
 * HTML entity decode helper
 */
function htmlDecode(text: string): string {
  const textarea = typeof document !== 'undefined' 
    ? document.createElement('textarea')
    : null;
  
  if (textarea) {
    textarea.innerHTML = text;
    return textarea.value;
  }
  
  // Server-side fallback
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * First pass: Split text into words with basic cleanup
 */
function splitTextFirstPass(
  selectedText: string,
  settings: ReaderSettings
): FirstPassItem[] {
  const result: FirstPassItem[] = [];
  
  if (!selectedText) return result;
  
  // Decode HTML entities
  let text = htmlDecode(selectedText);
  
  // Add space after punctuation if missing (helps with splitting)
  text = text.replace(/([.,?!:;])(?! )/g, '$1 ');
  
  // Split by whitespace
  const words = text.match(/\S+/g) || [];
  
  let slideNumber = 1;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Handle hyphenated words
    if (word.includes('-') && word.length > 1 && settings.chunkSize === 1) {
      const parts = word.split('-');
      
      // Keep short hyphenated words together (e.g., "co-founder")
      if (parts.length === 2 && word.length <= 12) {
        result.push({
          text: word,
          textOriginal: word,
          slideNumber: slideNumber++,
          isChildOfPrevious: false,
        });
      } else {
        // Split longer hyphenated words
        parts.forEach((part, idx) => {
          if (part) {
            result.push({
              text: idx < parts.length - 1 ? `${part}-` : part,
              textOriginal: word,
              slideNumber: idx === 0 ? slideNumber++ : slideNumber - 1,
              isChildOfPrevious: idx > 0,
            });
          }
        });
      }
      continue;
    }
    
    // Handle long words (>17 chars) - split them
    if (word.length > 17 && settings.chunkSize === 1) {
      const chunks = splitLongWord(word);
      chunks.forEach((chunk, idx) => {
        result.push({
          text: idx < chunks.length - 1 ? `${chunk}-` : chunk,
          textOriginal: word,
          slideNumber: idx === 0 ? slideNumber++ : slideNumber - 1,
          isChildOfPrevious: idx > 0,
        });
      });
      continue;
    }
    
    // Regular word
    result.push({
      text: word,
      textOriginal: word,
      slideNumber: slideNumber++,
      isChildOfPrevious: false,
    });
  }
  
  return result;
}

/**
 * Split a long word into readable chunks
 */
function splitLongWord(word: string, maxLength: number = 10): string[] {
  const chunks: string[] = [];
  let remaining = word;
  
  while (remaining.length > maxLength) {
    // Try to find a good break point (vowel followed by consonant)
    let breakPoint = maxLength;
    
    for (let i = maxLength - 2; i >= Math.floor(maxLength / 2); i--) {
      const char = remaining[i].toLowerCase();
      const nextChar = remaining[i + 1]?.toLowerCase();
      
      // Break after vowel before consonant
      if ('aeiou'.includes(char) && nextChar && !'aeiou'.includes(nextChar)) {
        breakPoint = i + 1;
        break;
      }
    }
    
    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint);
  }
  
  if (remaining) {
    chunks.push(remaining);
  }
  
  return chunks;
}

/**
 * Check if a string is only punctuation/symbols (no actual letters or numbers)
 */
function isPunctuationOnly(text: string): boolean {
  // Remove all punctuation, symbols, and whitespace
  const stripped = text.replace(/[\s\p{P}\p{S}]/gu, '');
  return stripped.length === 0;
}

/**
 * Second pass: Clean up empty slides and prepare final structure
 */
function splitTextSecondPass(
  firstPass: FirstPassItem[],
  deleteEmpty: boolean = true
): FirstPassItem[] {
  if (deleteEmpty) {
    return firstPass.filter(item => {
      if (!item.text || !item.text.trim()) return false;
      // Filter out punctuation-only items (e.g., "—", "...", """, etc.)
      if (isPunctuationOnly(item.text)) return false;
      return true;
    });
  }
  return firstPass;
}

/**
 * Calculate the Optimal Recognition Point (ORP) position
 * This is the letter that the eye naturally focuses on
 */
export function calculateORP(text: string): number {
  const length = text.length;
  
  if (length === 1) return 1;
  if (length <= 4) return 2;
  if (length <= 9) return 3;
  return 4;
}

/**
 * Calculate pixel offset to the center of the optimal letter
 * Uses Canvas API for accurate text measurement
 */
export function calculatePixelOffset(
  text: string,
  orpPosition: number,
  font: string,
  fontSize: number
): number {
  if (typeof document === 'undefined') {
    // Server-side fallback - estimate based on average char width
    const avgCharWidth = fontSize * 0.6;
    return (orpPosition - 0.5) * avgCharWidth;
  }
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return 0;
  
  ctx.font = `${fontSize}px ${font}`;
  
  const textToORP = text.slice(0, orpPosition - 1);
  const orpLetter = text[orpPosition - 1] || '';
  
  const widthToORP = ctx.measureText(textToORP).width;
  const orpLetterWidth = ctx.measureText(orpLetter).width;
  
  return widthToORP + (orpLetterWidth / 2);
}

/**
 * Check for punctuation that triggers pauses
 */
function getPunctuationDelay(
  text: string,
  settings: ReaderSettings
): { preDelay: number; postDelay: number } {
  const preDelay = 0;
  let postDelay = 0;
  
  const lastChar = text.slice(-1);
  
  // Comma, semicolon, colon
  if ([',', ';', ':'].includes(lastChar)) {
    if (settings.pauseAfterComma) {
      postDelay = settings.pauseAfterCommaDelay;
    }
  }
  
  // Period, question, exclamation
  if (['.', '?', '!'].includes(lastChar)) {
    if (settings.pauseAfterPeriod) {
      postDelay = settings.pauseAfterPeriodDelay;
    }
  }
  
  // Paragraph (newline)
  if (text.includes('\n') || text.includes('\r')) {
    if (settings.pauseAfterParagraph) {
      postDelay = Math.max(postDelay, settings.pauseAfterParagraphDelay);
    }
  }
  
  return { preDelay, postDelay };
}

/**
 * Main tokenization function - convert text to slides
 */
export function tokenizeText(
  text: string,
  settings: ReaderSettings
): TextSlide[] {
  const firstPass = splitTextFirstPass(text, settings);
  const secondPass = splitTextSecondPass(firstPass, true);
  
  const slides: TextSlide[] = [];
  let currentSlideNumber = 1;
  
  for (let i = 0; i < secondPass.length; ) {
    const slide: TextSlide = {
      text: '',
      textOriginal: '',
      duration: 0,
      preDelay: 0,
      postDelay: 0,
      wpm: settings.wpm,
      optimalLetterPosition: 1,
      pixelOffset: 0,
      slideNumber: currentSlideNumber,
      wordsInSlide: 0,
      isChildOfPrevious: false,
      hasBeenReversed: false,
    };
    
    // Build chunk based on chunkSize
    const wordsToAdd: string[] = [];
    let j = 0;
    
    while (j < settings.chunkSize && i + j < secondPass.length) {
      const item = secondPass[i + j];
      wordsToAdd.push(item.text);
      
      // Check for punctuation that should end the chunk early
      const lastChar = item.text.slice(-1);
      if ([',', ';', ':', '.', '?', '!'].includes(lastChar)) {
        j++;
        break;
      }
      
      // Check for newline
      if (item.text.includes('\n')) {
        j++;
        break;
      }
      
      j++;
    }
    
    slide.text = wordsToAdd.join(' ').trim();
    slide.textOriginal = secondPass[i].textOriginal;
    slide.wordsInSlide = j;
    slide.isChildOfPrevious = secondPass[i].isChildOfPrevious;
    
    if (slide.isChildOfPrevious) {
      slide.slideNumber = currentSlideNumber;
    } else {
      slide.slideNumber = currentSlideNumber;
      currentSlideNumber++;
    }
    
    // Calculate ORP
    slide.optimalLetterPosition = calculateORP(slide.text);
    slide.pixelOffset = calculatePixelOffset(
      slide.text,
      slide.optimalLetterPosition,
      settings.font,
      settings.fontSize
    );
    
    // Add punctuation delays
    const { preDelay, postDelay } = getPunctuationDelay(slide.text, settings);
    slide.preDelay = preDelay;
    slide.postDelay = postDelay;
    
    slides.push(slide);
    i += j;
  }
  
  // Remove post-delay from last slide
  if (slides.length > 0) {
    slides[slides.length - 1].postDelay = 0;
  }
  
  return slides;
}
