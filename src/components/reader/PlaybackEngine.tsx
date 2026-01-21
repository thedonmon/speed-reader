'use client';

import { useEffect, useRef } from 'react';
import { useReaderStore } from '@/stores/reader-store';

/**
 * PlaybackEngine handles the timing/playback loop
 * Uses setTimeout for accurate timing (RAF not needed for this use case)
 */
export function PlaybackEngine() {
  const {
    state,
    currentIndex,
    playbackPhase,
    slides,
    advancePhase,
    saveCurrentProgress,
    contentId,
  } = useReaderStore();

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Only run when playing
    if (state !== 'playing') {
      return;
    }

    const slide = slides[currentIndex];
    if (!slide) {
      return;
    }

    // Determine the duration for current phase
    let duration: number;
    switch (playbackPhase) {
      case 'pre':
        duration = slide.preDelay;
        break;
      case 'main':
        duration = slide.duration;
        break;
      case 'post':
        duration = slide.postDelay;
        break;
      default:
        duration = 0;
    }

    // If duration is 0, advance immediately
    if (duration <= 0) {
      advancePhase();
      return;
    }

    // Schedule the next phase
    timeoutRef.current = setTimeout(() => {
      advancePhase();
    }, duration);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [state, currentIndex, playbackPhase, slides, advancePhase]);

  // Save progress when user leaves the page
  useEffect(() => {
    if (!contentId) return;

    const handleBeforeUnload = () => {
      saveCurrentProgress();
    };

    // Save on page hide (works better on mobile than beforeunload)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentProgress();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [contentId, saveCurrentProgress]);

  // This component doesn't render anything
  return null;
}
