'use client';

import { useMemo } from 'react';
import { Streamdown } from 'streamdown';
import { createCodePlugin } from '@streamdown/code';
import { cn } from '@/lib/utils';
import { useIsDarkMode } from '@/hooks/useIsDarkMode';

// WORKAROUND: Create separate code plugins for light and dark themes.
// Streamdown's dual-theme approach uses CSS `dark:text-(--shiki-dark)!` to override
// inline styles, but inline styles have higher specificity than CSS classes (even with !important).
// So we swap plugins based on the active theme instead.
const lightCodePlugin = createCodePlugin({ themes: ['github-light', 'github-light'] });
const darkCodePlugin = createCodePlugin({ themes: ['dracula', 'dracula'] });
import type { TextSlide, BlockSlide } from '@/lib/engine/types';

interface WordDisplayProps {
  slide: TextSlide | null;
  settings: {
    font: string;
    fontSize: number;
    highlightOptimalLetter: boolean;
    highlightColor: string;
    textPosition: 'centered' | 'left' | 'optimal' | 'optimalWithFocal';
    focalCharacter: string;
  };
  className?: string;
  compact?: boolean; // Brings focal arrows closer to text (for fullscreen mode)
}

/**
 * Arrow indicator component for the focal point
 * Matches the Sprint Reader style with filled triangles
 * Gap is measured from the tip of the arrow to the text
 */
function FocalArrows({ color, gap = 8 }: { color: string; gap?: number }) {
  const arrowSize = 8;
  const arrowHeight = 12;
  
  return (
    <>
      {/* Top arrow (pointing down) - gap is from tip to text */}
      <div 
        className="absolute left-1/2 -translate-x-1/2"
        style={{ 
          bottom: `calc(100% + ${gap}px)`,
          width: 0,
          height: 0,
          borderLeft: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid transparent`,
          borderTop: `${arrowHeight}px solid ${color}`,
        }}
      />
      {/* Bottom arrow (pointing up) - gap is from tip to text, tip is at top of border */}
      <div 
        className="absolute left-1/2 -translate-x-1/2"
        style={{ 
          top: `calc(100% + ${gap}px + ${arrowHeight}px)`,
          width: 0,
          height: 0,
          borderLeft: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowHeight}px solid ${color}`,
        }}
      />
    </>
  );
}

export function WordDisplay({ slide, settings, className, compact = false }: WordDisplayProps) {
  const isDarkMode = useIsDarkMode();
  const codePlugin = isDarkMode ? darkCodePlugin : lightCodePlugin;

  const { chars, focalIndex, paddingLeft } = useMemo(() => {
    if (!slide) {
      return { chars: [], focalIndex: -1, paddingLeft: 0 };
    }

    let text = slide.text;
    let focal = slide.optimalLetterPosition - 1; // Convert to 0-indexed

    // Add focal character if using optimalWithFocal
    if (settings.textPosition === 'optimalWithFocal') {
      const before = text.slice(0, focal);
      const after = text.slice(focal);
      text = before + settings.focalCharacter + after;
      focal = focal; // Focal stays at same position
    }

    const chars = text.split('').map((char, i) => ({
      char,
      isOptimal: settings.highlightOptimalLetter && i === focal,
    }));

    // Calculate padding for optimal positioning
    let paddingLeft = 0;
    if (settings.textPosition === 'optimal' || settings.textPosition === 'optimalWithFocal') {
      paddingLeft = slide.pixelOffset;
    }

    return { chars, focalIndex: focal, paddingLeft };
  }, [slide, settings]);

  // Show focal arrows for optimal positioning modes
  const showFocalArrows = settings.textPosition === 'optimal' || settings.textPosition === 'optimalWithFocal';

  if (!slide) {
    // "Ready" state - no focal arrows needed
    return (
      <div className={cn('flex items-center justify-center h-full relative', className)}>
        <span 
          className="text-muted-foreground"
          style={{ fontFamily: settings.font, fontSize: settings.fontSize * 0.5 }}
        >
          Ready
        </span>
      </div>
    );
  }

  // Check if this is a special block type
  const blockType = (slide as TextSlide & { blockType?: string }).blockType;

  // Code blocks and tables - render with Streamdown (scrollable)
  if (blockType === 'code' || blockType === 'table') {
    // WORKAROUND: Streamdown incorrectly interprets $$ inside code blocks as math delimiters
    // Escape $$ by inserting a zero-width space between them
    // TODO: Remove once streamdown releases fix from https://github.com/vercel/streamdown/pull/365
    const safeText = blockType === 'code' 
      ? slide.text.replace(/\$\$/g, '$\u200B$')  // Zero-width space between $
      : slide.text;
    
    return (
      <div className={cn(
        'flex items-start justify-center h-full p-4',
        'streamdown-container',
        className
      )}>
        <div className="w-full max-w-4xl max-h-full overflow-auto rounded-lg">
          <Streamdown 
            key={isDarkMode ? 'dark' : 'light'}
            plugins={{ code: codePlugin }}
          >
            {safeText}
          </Streamdown>
        </div>
      </div>
    );
  }

  if (blockType === 'image') {
    const metadata = (slide as TextSlide & { metadata?: { src?: string; alt?: string } }).metadata;
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center">
          {metadata?.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={metadata.src} 
              alt={metadata.alt || 'Image'} 
              className="max-h-64 object-contain"
            />
          ) : (
            <span className="text-muted-foreground">[Image: {slide.text}]</span>
          )}
        </div>
      </div>
    );
  }

  if (blockType === 'heading') {
    const level = (slide as TextSlide & { metadata?: { level?: number } }).metadata?.level || 1;
    const headingSize = {
      1: 'text-4xl',
      2: 'text-3xl',
      3: 'text-2xl',
      4: 'text-xl',
      5: 'text-lg',
      6: 'text-base',
    }[level] || 'text-2xl';

    // Strip # prefix from heading text for display
    const headingText = slide.text.replace(/^#+\s*/, '');

    // Headings are displayed centered without focal arrows (not RSVP)
    return (
      <div className={cn('flex items-center justify-center h-full relative', className)}>
        <span 
          className={cn('font-bold', headingSize)}
          style={{ fontFamily: settings.font }}
        >
          {headingText}
        </span>
      </div>
    );
  }



  // Regular text display with ORP highlighting
  const justifyClass = {
    centered: 'justify-center',
    left: 'justify-start',
    optimal: 'justify-start',
    optimalWithFocal: 'justify-start',
  }[settings.textPosition];

  // Gap between arrows and text
  const arrowGap = compact ? 6 : 12;

  return (
    <div 
      className={cn(
        'flex items-center h-full relative overflow-hidden',
        justifyClass,
        className
      )}
    >
      {/* Text container with arrows positioned relative to it */}
      <div 
        className="relative whitespace-nowrap"
        style={{ 
          fontFamily: settings.font, 
          fontSize: settings.fontSize,
          marginLeft: paddingLeft > 0 ? `calc(40% - ${paddingLeft}px)` : undefined,
        }}
      >
        {/* Focal point arrows - positioned at the ORP (optimal recognition point) */}
        {showFocalArrows && (
          <div 
            className="absolute inset-y-0 pointer-events-none flex items-center"
            style={{ left: `${paddingLeft}px` }}
          >
            <div className="relative" style={{ height: `${settings.fontSize}px` }}>
              <FocalArrows color={settings.highlightColor} gap={arrowGap} />
            </div>
          </div>
        )}
        
        {chars.map((item, i) => (
          <span
            key={i}
            style={item.isOptimal ? { color: settings.highlightColor } : undefined}
            className={item.isOptimal ? 'font-bold' : undefined}
          >
            {item.char}
          </span>
        ))}
      </div>
    </div>
  );
}
