'use client';

import { useState, useEffect, useCallback, useRef, Suspense, useEffectEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Settings, ChevronLeft, Maximize2, Minimize2, Github, FileText } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WordDisplay } from '@/components/reader/WordDisplay';
import { Controls } from '@/components/reader/Controls';
import { FocusedControls } from '@/components/reader/FocusedControls';
import { PlaybackEngine } from '@/components/reader/PlaybackEngine';
import { SettingsPanel } from '@/components/reader/SettingsPanel';
import { InputPanel } from '@/components/reader/InputPanel';
import { ResumePrompt } from '@/components/reader/ResumePrompt';
import { DocumentViewer } from '@/components/reader/DocumentViewer';
import { ThemeToggle } from '@/components/theme-toggle';
import { useReaderStore } from '@/stores/reader-store';
import { useTouchGestures } from '@/hooks/useTouchGestures';
import { cn } from '@/lib/utils';
import { parseMarkdown, isMarkdown } from '@/lib/parsers/markdown';

// Wrapper component to handle Suspense for useSearchParams
export default function Home() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeContent />
    </Suspense>
  );
}

// Loading fallback
function HomeLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

// URL loading state
type UrlLoadState = { loading: boolean; error: string | null };

function HomeContent() {
  const searchParams = useSearchParams();
  const [showSettings, setShowSettings] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [focusedMode, setFocusedMode] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [urlLoadState, setUrlLoadState] = useState<UrlLoadState>({ loading: false, error: null });
  const urlLoadedRef = useRef(false);
  const { state, slides, settings, clear, currentSlide, play, pause, next, previous, setWPM, loadText, loadContent } = useReaderStore();
  const focusedContainerRef = useRef<HTMLDivElement>(null);
  
  const hasContent = slides.length > 0;
  const isPlaying = state === 'playing';

  // Handle URL query parameter (?url=...)
  // Using useEffectEvent for the fetch handler to avoid lint warnings
  const onFetchUrl = useEffectEvent(async (url: string) => {
    setUrlLoadState({ loading: true, error: null });

    try {
      const response = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch URL');
      }

      const data = await response.json();
      
      if (data.content) {
        if (isMarkdown(data.content)) {
          const parsed = parseMarkdown(data.content);
          parsed.title = parsed.title || data.title;
          loadContent(parsed);
        } else {
          loadText(data.content, data.title);
        }
        setUrlLoadState({ loading: false, error: null });
      } else {
        throw new Error('No content found');
      }
    } catch (err) {
      setUrlLoadState({ 
        loading: false, 
        error: err instanceof Error ? err.message : 'Failed to fetch URL' 
      });
    }
  });

  useEffect(() => {
    const urlParam = searchParams.get('url');
    if (!urlParam || urlLoadedRef.current || hasContent) return;
    
    urlLoadedRef.current = true;
    onFetchUrl(urlParam);
  }, [searchParams, hasContent]);

  // Auto-hide controls in focused mode when playing
  const onShowControls = useEffectEvent(() => {
    setControlsVisible(true);
  });

  const onHideControls = useEffectEvent(() => {
    setControlsVisible(false);
  });

  useEffect(() => {
    if (!focusedMode || !isPlaying) {
      onShowControls();
      return;
    }

    const timer = setTimeout(() => {
      onHideControls();
    }, 3000);

    return () => clearTimeout(timer);
  }, [focusedMode, isPlaying, controlsVisible]);

  // Show controls on mouse/touch movement in focused mode
  const handleInteraction = useCallback(() => {
    if (focusedMode) {
      setControlsVisible(true);
    }
  }, [focusedMode]);

  // Handle tap to play/pause in focused mode
  const handleDisplayTap = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
    setControlsVisible(true);
  }, [isPlaying, play, pause]);

  // Touch gestures for focused mode
  const { bindGestures } = useTouchGestures({
    onSwipeLeft: () => { next(); setControlsVisible(true); },
    onSwipeRight: () => { previous(); setControlsVisible(true); },
    onSwipeUp: () => { setWPM(Math.min(settings.wpm + 50, 1500)); setControlsVisible(true); },
    onSwipeDown: () => { setWPM(Math.max(settings.wpm - 50, 50)); setControlsVisible(true); },
    onTap: handleDisplayTap,
  });

  // Bind touch gestures to focused container
  useEffect(() => {
    if (focusedMode && focusedContainerRef.current) {
      return bindGestures(focusedContainerRef.current);
    }
  }, [focusedMode, bindGestures]);

  // Exit focused mode with Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusedMode) {
        setFocusedMode(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [focusedMode]);

  // Focused reading mode - full screen minimal UI
  if (focusedMode && hasContent) {
    return (
      <div 
        ref={focusedContainerRef}
        className="fixed inset-0 bg-background z-50 flex flex-col touch-manipulation select-none"
        onMouseMove={handleInteraction}
      >
        <PlaybackEngine />
        
        {/* Minimal header - auto-hides */}
        <header 
          className={cn(
            "absolute top-0 left-0 right-0 z-10 transition-opacity duration-300",
            controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          data-no-tap
        >
          <div className="flex items-center justify-between p-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setFocusedMode(false)}
            >
              <Minimize2 className="h-4 w-4 mr-2" />
              Exit
            </Button>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => {
                  setFocusedMode(false);
                  setShowDocumentViewer(true);
                }}
                title="View full document"
              >
                <FileText className="h-5 w-5" />
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Word display - gestures handled by useTouchGestures */}
        <div className="flex-1 flex items-center justify-center">
          <WordDisplay 
            slide={currentSlide()} 
            settings={settings}
            className="w-full h-full px-4 md:px-8"
            compact
          />
        </div>

        {/* Focused controls - auto-hides */}
        <div 
          className={cn(
            "absolute bottom-0 left-0 right-0 z-10 transition-opacity duration-300",
            controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          data-no-tap
        >
          <FocusedControls />
        </div>

        {/* Gesture hints - shown briefly */}
        {controlsVisible && (
          <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 pointer-events-none flex justify-between text-muted-foreground/30 text-xs">
            <span className="hidden sm:block">Swipe right: Previous</span>
            <span className="hidden sm:block">Swipe left: Next</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Playback engine (invisible) */}
      <PlaybackEngine />

      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image 
              src="/logo.png" 
              alt="SkimReaper" 
              width={930} 
              height={700}
              className="h-10 w-auto"
            />
            <h1 className="text-xl font-bold font-mono tracking-tight">SkimReaper</h1>
          </div>
          
          <div className="flex items-center gap-1">
            {hasContent && (
              <>
                <Button variant="ghost" size="sm" onClick={clear}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  New
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowDocumentViewer(true)}
                  title="View full document"
                >
                  <FileText className="h-5 w-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setFocusedMode(true)}
                  title="Focused reading mode"
                >
                  <Maximize2 className="h-5 w-5" />
                </Button>
              </>
            )}
            <ThemeToggle />
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className={cn('h-5 w-5', showSettings && 'text-primary')} />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Main content area */}
          <div className={cn('flex-1 space-y-6', showSettings && 'lg:max-w-[calc(100%-320px)]')}>
            {!hasContent ? (
              /* Input mode */
              <>
                {/* URL loading state */}
                {urlLoadState.loading && (
                  <Card>
                    <CardContent className="py-8">
                      <div className="flex flex-col items-center gap-4">
                        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                        <p className="text-muted-foreground">Loading content from URL...</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* URL error state */}
                {urlLoadState.error && (
                  <Card className="border-destructive">
                    <CardContent className="py-6">
                      <div className="flex flex-col items-center gap-4 text-center">
                        <p className="text-destructive font-medium">Failed to load URL</p>
                        <p className="text-sm text-muted-foreground">{urlLoadState.error}</p>
                        <Button variant="outline" onClick={() => setUrlLoadState({ loading: false, error: null })}>
                          Try Again
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Normal input panel */}
                {!urlLoadState.loading && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Load Content</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <InputPanel />
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              /* Reading mode */
              <>
                {/* Resume prompt */}
                <ResumePrompt />

                {/* Word display area */}
                <Card className="overflow-hidden touch-manipulation">
                  <CardContent className="p-0">
                    <div 
                      className="h-48 sm:h-64 md:h-80 lg:h-96 bg-card flex items-center justify-center"
                      style={{ 
                        backgroundColor: state === 'playing' ? 'hsl(var(--card))' : undefined 
                      }}
                    >
                      <WordDisplay 
                        slide={currentSlide()} 
                        settings={settings}
                        className="w-full h-full px-4 sm:px-8"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Controls */}
                <Card>
                  <CardContent className="pt-4 sm:pt-6">
                    <Controls />
                  </CardContent>
                </Card>

                {/* Mobile: Quick access to focused mode */}
                <div className="sm:hidden">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setFocusedMode(true)}
                  >
                    <Maximize2 className="h-4 w-4 mr-2" />
                    Focused Reading Mode
                  </Button>
                </div>
              </>
            )}

            {/* Quick tips */}
            {!hasContent && !urlLoadState.loading && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">How it works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    <strong>RSVP (Rapid Serial Visual Presentation)</strong> displays words 
                    one at a time at a fixed point, eliminating eye movement and enabling 
                    faster reading.
                  </p>
                  <p>
                    The <strong>Optimal Recognition Point (ORP)</strong> is highlighted to 
                    help your brain process each word more efficiently.
                  </p>
                  <p>
                    Try the <strong>Word Frequency</strong> algorithm for smarter timing - 
                    common words flash quickly while rare words are shown longer.
                  </p>
                  <p>
                    <strong>Quick tip:</strong> Add <code className="bg-muted px-1 py-0.5 rounded text-xs">?url=</code> to 
                    share articles directly, e.g. <code className="bg-muted px-1 py-0.5 rounded text-xs break-all">skimreaper.xyz?url=https://example.com/article</code>
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Settings sidebar */}
          {showSettings && (
            <aside className="hidden lg:block w-80 shrink-0">
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <SettingsPanel />
                </CardContent>
              </Card>
            </aside>
          )}
        </div>

        {/* Mobile settings (bottom sheet style) */}
        {showSettings && (
          <div className="lg:hidden fixed inset-x-0 bottom-0 z-50">
            <Card className="rounded-t-xl rounded-b-none max-h-[70vh] overflow-y-auto">
              <CardHeader className="sticky top-0 bg-card z-10 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle>Settings</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowSettings(false)}
                  >
                    Done
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pb-8">
                <SettingsPanel />
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4 flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <Image 
            src="/logo.png" 
            alt="SkimReaper" 
            width={930} 
            height={700}
            className="h-12 w-auto"
          />
          <div className="flex items-center gap-2">
            <span>Built with Next.js.</span>
            <span>Inspired by <a href="https://github.com/anthonynosek/sprint-reader-chrome" className="underline hover:text-foreground">Sprint Reader</a>.</span>
            <a 
              href="https://github.com/thedonmon/skimreaper" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
              title="View source on GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
      </footer>

      {/* Document Viewer Overlay */}
      {showDocumentViewer && (
        <DocumentViewer onClose={() => setShowDocumentViewer(false)} />
      )}
    </div>
  );
}
