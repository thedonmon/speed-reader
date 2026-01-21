'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TextSlide, ReaderSettings, SlideShowData, ParsedContent } from '@/lib/engine/types';
import { DEFAULT_SETTINGS, processText, processContent, recalculatePixelOffsets } from '@/lib/engine';
import { adjustTimingByWPM } from '@/lib/engine/timing';
import { 
  createChunkedProcessor, 
  estimateReadingTime, 
  type ChunkedProcessor 
} from '@/lib/engine/chunked-processor';

export type ReaderState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'finished';

export type InputMode = 'text' | 'url' | 'file';

// Threshold for using chunked processing (characters)
const LARGE_TEXT_THRESHOLD = 50000; // ~10k words

interface ReaderStore {
  // Input
  inputMode: InputMode;
  inputText: string;
  inputUrl: string;
  
  // Content
  slides: TextSlide[];
  stats: SlideShowData | null;
  parsedContent: ParsedContent | null;
  blockIndices: number[];
  
  // Chunked processing for large texts
  chunkedProcessor: ChunkedProcessor | null;
  isLargeText: boolean;
  processingProgress: number; // 0-100
  
  // Source info
  sourceTitle: string;
  sourceInfo: { words: number; minutes: number; seconds: number } | null;
  
  // Playback state
  state: ReaderState;
  currentIndex: number;
  playbackPhase: 'pre' | 'main' | 'post';
  
  // Settings
  settings: ReaderSettings;
  
  // Actions - Input
  setInputMode: (mode: InputMode) => void;
  setInputText: (text: string) => void;
  setInputUrl: (url: string) => void;
  
  // Actions - Content
  loadText: (text: string, title?: string) => void;
  loadContent: (content: ParsedContent) => void;
  processMoreChunks: () => void;
  clear: () => void;
  
  // Actions - Playback
  play: () => void;
  pause: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
  goToSlide: (index: number) => void;
  advancePhase: () => void;
  
  // Actions - Settings
  updateSettings: (partial: Partial<ReaderSettings>) => void;
  setWPM: (wpm: number) => void;
  
  // Computed
  currentSlide: () => TextSlide | null;
  progress: () => number;
  totalSlides: () => number;
  currentBlockType: () => string | null;
}

export const useReaderStore = create<ReaderStore>()(
  persist(
    (set, get) => ({
      // Initial state
      inputMode: 'text',
      inputText: '',
      inputUrl: '',
      
      slides: [],
      stats: null,
      parsedContent: null,
      blockIndices: [],
      
      chunkedProcessor: null,
      isLargeText: false,
      processingProgress: 0,
      
      sourceTitle: '',
      sourceInfo: null,
      
      state: 'idle',
      currentIndex: 0,
      playbackPhase: 'pre',
      
      settings: DEFAULT_SETTINGS,
      
      // Input actions
      setInputMode: (mode) => set({ inputMode: mode }),
      setInputText: (text) => set({ inputText: text }),
      setInputUrl: (url) => set({ inputUrl: url }),
      
      // Content actions
      loadText: (text, title) => {
        const { settings } = get();
        const isLarge = text.length > LARGE_TEXT_THRESHOLD;
        const readingEstimate = estimateReadingTime(text, settings.wpm);
        
        if (isLarge) {
          // Use chunked processing for large texts
          const processor = createChunkedProcessor(text, settings);
          
          // Get initial slides
          const initialSlides = processor.getSlides(0, 500);
          
          set({
            slides: initialSlides,
            stats: processor.getStats(),
            parsedContent: null,
            blockIndices: [],
            chunkedProcessor: processor,
            isLargeText: true,
            processingProgress: processor.isFullyProcessed ? 100 : 
              Math.round((processor.processedSlidesCount / processor.totalEstimatedSlides) * 100),
            sourceTitle: title || 'Document',
            sourceInfo: readingEstimate,
            state: 'ready',
            currentIndex: 0,
            playbackPhase: 'pre',
          });
          
          // Continue processing in background
          if (!processor.isFullyProcessed) {
            setTimeout(() => get().processMoreChunks(), 100);
          }
        } else {
          // Small text - process all at once
          const { slides, stats } = processText(text, settings);
          
          set({
            slides,
            stats,
            parsedContent: null,
            blockIndices: [],
            chunkedProcessor: null,
            isLargeText: false,
            processingProgress: 100,
            sourceTitle: title || 'Document',
            sourceInfo: readingEstimate,
            state: 'ready',
            currentIndex: 0,
            playbackPhase: 'pre',
          });
        }
      },
      
      loadContent: (content) => {
        const { settings } = get();
        const { slides, stats, blockIndices } = processContent(content, settings);
        
        // Calculate total text for reading estimate
        const totalText = content.blocks.map(b => b.content).join(' ');
        const readingEstimate = estimateReadingTime(totalText, settings.wpm);
        
        set({
          slides,
          stats,
          parsedContent: content,
          blockIndices,
          chunkedProcessor: null,
          isLargeText: false,
          processingProgress: 100,
          sourceTitle: content.title || 'Document',
          sourceInfo: readingEstimate,
          state: 'ready',
          currentIndex: 0,
          playbackPhase: 'pre',
        });
      },
      
      processMoreChunks: () => {
        const { chunkedProcessor, state } = get();
        if (!chunkedProcessor || chunkedProcessor.isFullyProcessed) return;
        
        // Process a few more chunks
        for (let i = 0; i < 3 && chunkedProcessor.processMore(); i++) {
          // Process up to 3 chunks at a time
        }
        
        // Update slides array with all processed slides
        const allSlides = chunkedProcessor.getSlides(0, chunkedProcessor.processedSlidesCount);
        
        set({
          slides: allSlides,
          stats: chunkedProcessor.getStats(),
          processingProgress: chunkedProcessor.isFullyProcessed ? 100 :
            Math.round((chunkedProcessor.processedSlidesCount / chunkedProcessor.totalEstimatedSlides) * 100),
        });
        
        // Continue processing if not done and not finished reading
        if (!chunkedProcessor.isFullyProcessed && state !== 'finished') {
          setTimeout(() => get().processMoreChunks(), 50);
        }
      },
      
      clear: () => {
        const { chunkedProcessor } = get();
        // Clean up chunked processor if exists
        if (chunkedProcessor) {
          // No explicit cleanup needed, just let it be garbage collected
        }
        
        set({
          slides: [],
          stats: null,
          parsedContent: null,
          blockIndices: [],
          chunkedProcessor: null,
          isLargeText: false,
          processingProgress: 0,
          sourceTitle: '',
          sourceInfo: null,
          state: 'idle',
          currentIndex: 0,
          playbackPhase: 'pre',
          inputText: '',
          inputUrl: '',
        });
      },
      
      // Playback actions
      play: () => {
        const { slides, state, chunkedProcessor } = get();
        if (slides.length === 0) return;
        
        if (state === 'finished') {
          set({ currentIndex: 0, playbackPhase: 'pre' });
        }
        
        // Resume background processing if needed
        if (chunkedProcessor && !chunkedProcessor.isFullyProcessed) {
          setTimeout(() => get().processMoreChunks(), 100);
        }
        
        set({ state: 'playing' });
      },
      
      pause: () => set({ state: 'paused' }),
      
      stop: () => set({ 
        state: 'ready', 
        currentIndex: 0, 
        playbackPhase: 'pre' 
      }),
      
      next: () => {
        const { currentIndex, slides, chunkedProcessor, state } = get();
        
        // For chunked processing, ensure we have slides ahead
        if (chunkedProcessor && !chunkedProcessor.isFullyProcessed) {
          if (currentIndex >= slides.length - 100) {
            // Getting close to end of processed slides, process more
            get().processMoreChunks();
          }
        }
        
        if (currentIndex < slides.length - 1) {
          set({ 
            currentIndex: currentIndex + 1,
            playbackPhase: 'pre',
            // Pause when manually navigating
            state: state === 'playing' ? 'paused' : state,
          });
        } else {
          set({ state: 'finished' });
        }
      },
      
      previous: () => {
        const { currentIndex, state } = get();
        if (currentIndex > 0) {
          set({ 
            currentIndex: currentIndex - 1,
            playbackPhase: 'pre',
            // Pause when manually navigating
            state: state === 'playing' ? 'paused' : state,
          });
        }
      },
      
      goToSlide: (index) => {
        const { slides, chunkedProcessor } = get();
        
        // For chunked processing, ensure target slide is processed
        if (chunkedProcessor && index >= slides.length) {
          // Process until we reach the target
          while (!chunkedProcessor.isFullyProcessed && chunkedProcessor.processedSlidesCount <= index) {
            chunkedProcessor.processMore();
          }
          // Update slides
          const allSlides = chunkedProcessor.getSlides(0, chunkedProcessor.processedSlidesCount);
          set({ 
            slides: allSlides,
            processingProgress: chunkedProcessor.isFullyProcessed ? 100 :
              Math.round((chunkedProcessor.processedSlidesCount / chunkedProcessor.totalEstimatedSlides) * 100),
          });
        }
        
        const currentSlides = get().slides;
        if (index >= 0 && index < currentSlides.length) {
          set({ 
            currentIndex: index,
            playbackPhase: 'pre',
            state: 'paused',
          });
        }
      },
      
      advancePhase: () => {
        const { playbackPhase, currentIndex, slides, chunkedProcessor } = get();
        
        if (playbackPhase === 'pre') {
          set({ playbackPhase: 'main' });
        } else if (playbackPhase === 'main') {
          set({ playbackPhase: 'post' });
        } else {
          // Post phase complete, move to next slide
          
          // Ensure more slides are processed if needed
          if (chunkedProcessor && !chunkedProcessor.isFullyProcessed) {
            if (currentIndex >= slides.length - 50) {
              get().processMoreChunks();
            }
          }
          
          const currentSlides = get().slides;
          if (currentIndex < currentSlides.length - 1) {
            set({ 
              currentIndex: currentIndex + 1,
              playbackPhase: 'pre',
            });
          } else {
            set({ state: 'finished' });
          }
        }
      },
      
      // Settings actions
      updateSettings: (partial) => {
        const { settings, slides } = get();
        const newSettings = { ...settings, ...partial };
        
        // If font or fontSize changed, recalculate pixel offsets
        if (partial.font || partial.fontSize) {
          recalculatePixelOffsets(slides, newSettings.font, newSettings.fontSize);
        }
        
        // If WPM changed, adjust timing
        if (partial.wpm && partial.wpm !== settings.wpm) {
          adjustTimingByWPM(slides, settings.wpm, partial.wpm);
        }
        
        set({ settings: newSettings });
      },
      
      setWPM: (wpm) => {
        const { settings, slides } = get();
        if (wpm !== settings.wpm) {
          adjustTimingByWPM(slides, settings.wpm, wpm);
          set({ 
            settings: { ...settings, wpm },
          });
        }
      },
      
      // Computed values
      currentSlide: () => {
        const { slides, currentIndex } = get();
        return slides[currentIndex] || null;
      },
      
      progress: () => {
        const { currentIndex, chunkedProcessor, slides } = get();
        const total = chunkedProcessor 
          ? chunkedProcessor.totalEstimatedSlides 
          : slides.length;
        if (total === 0) return 0;
        return ((currentIndex + 1) / total) * 100;
      },
      
      totalSlides: () => {
        const { chunkedProcessor, slides } = get();
        return chunkedProcessor 
          ? chunkedProcessor.totalEstimatedSlides 
          : slides.length;
      },
      
      currentBlockType: () => {
        const slide = get().currentSlide();
        if (!slide) return null;
        return (slide as TextSlide & { blockType?: string }).blockType || 'text';
      },
    }),
    {
      name: 'speed-reader-settings',
      partialize: (state) => ({ 
        settings: state.settings,
        inputMode: state.inputMode,
      }),
    }
  )
);
