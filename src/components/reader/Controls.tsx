'use client';

import { useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  RotateCcw,
  Minus,
  Plus 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { useReaderStore, type ReaderState } from '@/stores/reader-store';
import { cn } from '@/lib/utils';

interface ControlsProps {
  className?: string;
}

export function Controls({ className }: ControlsProps) {
  const {
    state,
    currentIndex,
    slides,
    settings,
    stats,
    play,
    pause,
    stop,
    next,
    previous,
    goToSlide,
    setWPM,
    progress,
    totalSlides,
    isLargeText,
    processingProgress,
    sourceTitle,
    sourceInfo,
  } = useReaderStore();

  const currentProgress = progress();
  const total = totalSlides();
  const isPlaying = state === 'playing';
  const canPlay = slides.length > 0 && state !== 'loading';

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

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
      case 'Escape':
        e.preventDefault();
        stop();
        break;
      case 'KeyR':
        e.preventDefault();
        stop();
        break;
    }
  }, [isPlaying, canPlay, play, pause, stop, next, previous, setWPM, settings.wpm]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Calculate remaining time
  const remainingSlides = slides.slice(currentIndex);
  const remainingDuration = remainingSlides.reduce(
    (sum, s) => sum + s.duration + s.preDelay + s.postDelay, 
    0
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Source title */}
      {sourceTitle && (
        <div className="text-center">
          <h3 className="font-medium truncate" title={sourceTitle}>{sourceTitle}</h3>
          {sourceInfo && (
            <p className="text-xs text-muted-foreground">
              {sourceInfo.words.toLocaleString()} words 
              {' '} ~{sourceInfo.minutes}:{sourceInfo.seconds.toString().padStart(2, '0')} read time
            </p>
          )}
        </div>
      )}

      {/* Processing indicator for large texts */}
      {isLargeText && processingProgress < 100 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Processing text...</span>
            <span>{processingProgress}%</span>
          </div>
          <Progress value={processingProgress} className="h-1" />
        </div>
      )}

      {/* Progress bar */}
      <div className="space-y-2">
        <Progress value={currentProgress} className="h-2" />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{currentIndex + 1} / {total.toLocaleString()}</span>
          <span>{formatTime(remainingDuration)} remaining</span>
        </div>
      </div>

      {/* Main controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={stop}
          disabled={state === 'idle' || state === 'loading'}
          title="Restart (R)"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={previous}
          disabled={currentIndex === 0 || state === 'loading'}
          title="Previous (Left Arrow)"
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          size="lg"
          onClick={isPlaying ? pause : play}
          disabled={!canPlay}
          className="w-16 h-16 rounded-full"
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6 ml-1" />
          )}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={next}
          disabled={currentIndex >= slides.length - 1 || state === 'loading'}
          title="Next (Right Arrow)"
        >
          <SkipForward className="h-4 w-4" />
        </Button>

        <div className="w-10" /> {/* Spacer for symmetry */}
      </div>

      {/* WPM control */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setWPM(Math.max(settings.wpm - 50, 50))}
          title="Decrease speed (Down Arrow)"
        >
          <Minus className="h-4 w-4" />
        </Button>

        <div className="flex-1 space-y-1">
          <div className="flex justify-between">
            <span className="text-sm font-medium">Speed</span>
            <span className="text-sm font-mono">{settings.wpm} WPM</span>
          </div>
          <Slider
            value={[settings.wpm]}
            onValueChange={([value]) => setWPM(value)}
            min={50}
            max={1500}
            step={10}
          />
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setWPM(Math.min(settings.wpm + 50, 1500))}
          title="Increase speed (Up Arrow)"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="flex justify-center gap-6 text-sm text-muted-foreground">
          <span>Effective: {stats.realWPM} WPM</span>
          <span>Total: {formatTime(stats.totalDurationWithPauses)}</span>
        </div>
      )}

      {/* Keyboard hints */}
      <div className="text-center text-xs text-muted-foreground">
        <kbd className="px-1.5 py-0.5 bg-muted rounded">Space</kbd> Play/Pause
        {' '}<kbd className="px-1.5 py-0.5 bg-muted rounded">←→</kbd> Navigate
        {' '}<kbd className="px-1.5 py-0.5 bg-muted rounded">↑↓</kbd> Speed
      </div>
    </div>
  );
}
