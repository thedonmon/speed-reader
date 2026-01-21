// Timing algorithms for speed reading
// Ported from sprint-reader-chrome

import type { TextSlide, ReaderSettings, SlideShowData } from './types';
import { getWordInformation, INFO_LOW, INFO_HIGH } from './word-frequency';

/**
 * Basic timing algorithm
 * All words shown for equal time based on WPM setting
 */
export function applyBasicTiming(
  slides: TextSlide[],
  settings: ReaderSettings
): void {
  // Duration per word in ms: (1 / (WPM / 60)) * 1000
  const durationPerWord = (60 / settings.wpm) * 1000;
  
  for (const slide of slides) {
    slide.duration = durationPerWord * slide.wordsInSlide;
    
    // Enforce minimum slide duration
    if (slide.duration < settings.minSlideDuration) {
      slide.duration = settings.minSlideDuration;
    }
  }
}

/**
 * Word length timing algorithm
 * Longer words are shown for longer
 */
export function applyWordLengthTiming(
  slides: TextSlide[],
  settings: ReaderSettings
): void {
  // Calculate total expected duration
  const totalSegments = slides.length;
  const totalDuration = (totalSegments / settings.wpm) * 60000;
  
  // Get total character count
  const totalLength = slides.reduce((sum, s) => sum + s.text.length, 0);
  
  // Time per character
  const timePerChar = totalDuration / totalLength;
  
  for (const slide of slides) {
    slide.duration = timePerChar * slide.text.length;
    
    // Enforce minimum
    if (slide.duration < settings.minSlideDuration) {
      slide.duration = settings.minSlideDuration;
    }
  }
}

/**
 * Word frequency timing algorithm (Shannon Information Theory)
 * 
 * Based on how surprising it is to encounter a word:
 * - Common words (high probability) -> shown briefly
 * - Rare words (low probability) -> shown longer for comprehension
 * 
 * Uses linear interpolation between information bounds and duration bounds
 */
export function applyWordFrequencyTiming(
  slides: TextSlide[],
  settings: ReaderSettings
): void {
  const durShort = settings.wordFreqHighDuration; // Duration for common words
  const durLong = settings.wordFreqLowDuration;   // Duration for rare words
  
  // Linear interpolation coefficients
  // duration = a * information + b
  const a = (durLong - durShort) / (INFO_HIGH - INFO_LOW);
  const b = durShort - (INFO_LOW * a);
  
  for (const slide of slides) {
    // For multi-word slides, sum the information content
    const words = slide.text.split(/\s+/);
    let totalInfo = 0;
    
    for (const word of words) {
      // Strip punctuation for lookup
      const cleanWord = word.replace(/[.,?!;:'"()[\]{}]/g, '');
      if (cleanWord) {
        totalInfo += getWordInformation(cleanWord);
      }
    }
    
    // Average information per word
    const avgInfo = totalInfo / words.length;
    
    // Calculate duration using linear interpolation
    slide.duration = (a * avgInfo + b) * slide.wordsInSlide;
    
    // Enforce minimum
    if (slide.duration < settings.minSlideDuration) {
      slide.duration = settings.minSlideDuration;
    }
  }
}

/**
 * Apply timing based on selected algorithm
 */
export function applyTiming(
  slides: TextSlide[],
  settings: ReaderSettings
): void {
  switch (settings.algorithm) {
    case 'wordLength':
      applyWordLengthTiming(slides, settings);
      break;
    case 'wordFrequency':
      applyWordFrequencyTiming(slides, settings);
      break;
    case 'basic':
    default:
      applyBasicTiming(slides, settings);
  }
}

/**
 * Calculate slideshow statistics
 */
export function calculateSlideShowData(
  slides: TextSlide[],
  settings: ReaderSettings
): SlideShowData {
  if (slides.length === 0) {
    return {
      totalDuration: 0,
      totalDurationWithPauses: 0,
      totalSlides: 0,
      minDuration: 0,
      maxDuration: 0,
      realWPM: 0,
    };
  }
  
  let totalDuration = 0;
  let totalDurationWithPauses = 0;
  let minDuration = slides[0].duration;
  let maxDuration = slides[0].duration;
  let totalWords = 0;
  
  for (const slide of slides) {
    totalDuration += slide.duration;
    totalDurationWithPauses += slide.duration + slide.preDelay + slide.postDelay;
    totalWords += slide.wordsInSlide;
    
    if (slide.duration < minDuration) minDuration = slide.duration;
    if (slide.duration > maxDuration) maxDuration = slide.duration;
  }
  
  // Real WPM based on total duration
  const realWPM = totalDuration > 0 
    ? (totalWords / totalDuration) * 60000 
    : settings.wpm;
  
  return {
    totalDuration,
    totalDurationWithPauses,
    totalSlides: slides.length,
    minDuration,
    maxDuration,
    realWPM: Math.round(realWPM),
  };
}

/**
 * Adjust all slide timings by a WPM delta
 * Useful for real-time speed adjustment
 */
export function adjustTimingByWPM(
  slides: TextSlide[],
  currentWPM: number,
  newWPM: number
): void {
  const ratio = currentWPM / newWPM;
  
  for (const slide of slides) {
    slide.duration *= ratio;
    slide.wpm = newWPM;
  }
}
