// Core types for the speed reading engine

export interface TextSlide {
  text: string;
  textOriginal: string;
  duration: number;
  preDelay: number;
  postDelay: number;
  wpm: number;
  optimalLetterPosition: number;
  pixelOffset: number;
  slideNumber: number;
  wordsInSlide: number;
  isChildOfPrevious: boolean;
  hasBeenReversed: boolean;
}

export interface ReaderSettings {
  wpm: number;
  chunkSize: number;
  font: string;
  fontSize: number;
  algorithm: 'basic' | 'wordLength' | 'wordFrequency';
  textPosition: 'centered' | 'left' | 'optimal' | 'optimalWithFocal';
  pauseAfterComma: boolean;
  pauseAfterPeriod: boolean;
  pauseAfterParagraph: boolean;
  pauseAfterCommaDelay: number;
  pauseAfterPeriodDelay: number;
  pauseAfterParagraphDelay: number;
  highlightOptimalLetter: boolean;
  highlightColor: string;
  focalCharacter: string;
  minSlideDuration: number;
  // Word frequency algorithm settings
  wordFreqHighDuration: number;
  wordFreqLowDuration: number;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  wpm: 300,
  chunkSize: 1,
  font: 'system-ui',
  fontSize: 48,
  algorithm: 'basic',
  textPosition: 'optimal',
  pauseAfterComma: true,
  pauseAfterPeriod: true,
  pauseAfterParagraph: true,
  pauseAfterCommaDelay: 250,
  pauseAfterPeriodDelay: 450,
  pauseAfterParagraphDelay: 700,
  highlightOptimalLetter: true,
  highlightColor: '#ef4444',
  focalCharacter: '.',
  minSlideDuration: 50,
  wordFreqHighDuration: 40,
  wordFreqLowDuration: 300,
};

// Content block types for structured content (markdown, etc.)
export type ContentBlockType = 
  | 'text'
  | 'code'
  | 'heading'
  | 'blockquote'
  | 'image'
  | 'list'
  | 'table'
  | 'hr';

// Extended slide type for special blocks
export interface BlockSlide extends TextSlide {
  blockType: ContentBlockType;
  metadata?: {
    language?: string;
    level?: number;
    src?: string;
    alt?: string;
    ordered?: boolean;
  };
}

export interface ContentBlock {
  type: ContentBlockType;
  content: string;
  metadata?: {
    language?: string; // for code blocks
    level?: number; // for headings (1-6)
    src?: string; // for images
    alt?: string; // for images
    ordered?: boolean; // for lists
  };
}

export interface ParsedContent {
  blocks: ContentBlock[];
  title?: string;
  source?: string;
}

export interface SlideShowData {
  totalDuration: number;
  totalDurationWithPauses: number;
  totalSlides: number;
  minDuration: number;
  maxDuration: number;
  realWPM: number;
}
