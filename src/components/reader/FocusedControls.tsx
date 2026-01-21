'use client';

import { useEffect, useCallback } from 'react';
import { Play, Pause, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useReaderStore } from '@/stores/reader-store';
import { cn } from '@/lib/utils';

interface FocusedControlsProps {
  className?: string;
}

export function FocusedControls({ className }: FocusedControlsProps) {
  const {
    state,
    slides,
    settings,
    play,
    pause,
    next,
    previous,
    setWPM,
    progress,
    currentIndex,
    totalSlides,
  } = useReaderStore();

  const isPlaying = state === 'playing';
  const canPlay = slides.length > 0 && state !== 'loading';

  // Keyboard shortcuts for focused mode
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (isPlaying) {
          pause();
        } else if (canPlay) {
          play();
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        previous();
        break;
      case 'ArrowRight':
        e.preventDefault();
        next();
        break;
      case 'ArrowUp':
        e.preventDefault();
        setWPM(Math.min(settings.wpm + 50, 1500));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setWPM(Math.max(settings.wpm - 50, 50));
        break;
    }
  }, [isPlaying, canPlay, play, pause, next, previous, setWPM, settings.wpm]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const currentProgress = progress();
  const total = totalSlides();

  return (
    <div className={cn('p-4 pb-8 bg-gradient-to-t from-background via-background/95 to-transparent', className)}>
      {/* Progress bar */}
      <div className="mb-4">
        <Progress value={currentProgress} className="h-1" />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{currentIndex + 1} / {total.toLocaleString()}</span>
          <span>{settings.wpm} WPM</span>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-center gap-6">
        {/* Speed down */}
        <Button
          variant="ghost"
          size="lg"
          className="h-14 w-14 rounded-full"
          onClick={() => setWPM(Math.max(settings.wpm - 50, 50))}
        >
          <Minus className="h-6 w-6" />
        </Button>

        {/* Play/Pause */}
        <Button
          size="lg"
          className="h-16 w-16 rounded-full"
          onClick={isPlaying ? pause : play}
          disabled={!canPlay}
        >
          {isPlaying ? (
            <Pause className="h-8 w-8" />
          ) : (
            <Play className="h-8 w-8 ml-1" />
          )}
        </Button>

        {/* Speed up */}
        <Button
          variant="ghost"
          size="lg"
          className="h-14 w-14 rounded-full"
          onClick={() => setWPM(Math.min(settings.wpm + 50, 1500))}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Gesture hints */}
      <div className="text-center text-xs text-muted-foreground mt-4 space-y-1">
        <p className="sm:hidden">Tap to play/pause</p>
        <p className="sm:hidden">Swipe: left/right = navigate, up/down = speed</p>
        <p className="hidden sm:block">
          <kbd className="px-1.5 py-0.5 bg-muted rounded">Space</kbd> Play/Pause
          {' '}<kbd className="px-1.5 py-0.5 bg-muted rounded">&larr;</kbd><kbd className="px-1.5 py-0.5 bg-muted rounded">&rarr;</kbd> Navigate
          {' '}<kbd className="px-1.5 py-0.5 bg-muted rounded">&uarr;</kbd><kbd className="px-1.5 py-0.5 bg-muted rounded">&darr;</kbd> Speed
          {' '}<kbd className="px-1.5 py-0.5 bg-muted rounded">Esc</kbd> Exit
        </p>
      </div>
    </div>
  );
}
