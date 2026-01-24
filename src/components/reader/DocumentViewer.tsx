'use client';

import { useMemo, useRef, useEffect } from 'react';
import { Streamdown } from 'streamdown';
import { createCodePlugin } from '@streamdown/code';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useIsDarkMode } from '@/hooks/useIsDarkMode';
import { useReaderStore } from '@/stores/reader-store';
import type { ParsedContent } from '@/lib/engine/types';

// Code plugins for syntax highlighting
const lightCodePlugin = createCodePlugin({ themes: ['github-light', 'github-light'] });
const darkCodePlugin = createCodePlugin({ themes: ['dracula', 'dracula'] });

interface DocumentViewerProps {
  className?: string;
  onClose: () => void;
}

/**
 * Reconstructs the original markdown from parsed content blocks
 */
function reconstructMarkdown(content: ParsedContent): string {
  const parts: string[] = [];
  
  for (const block of content.blocks) {
    switch (block.type) {
      case 'code':
      case 'table':
        // These are stored as raw markdown
        parts.push(block.content);
        break;
      case 'heading':
        const level = block.metadata?.level || 1;
        const prefix = '#'.repeat(level);
        parts.push(`${prefix} ${block.content}`);
        break;
      case 'blockquote':
        // Re-add > prefix to each line
        const quoteLines = block.content.split('\n').map(line => `> ${line}`);
        parts.push(quoteLines.join('\n'));
        break;
      case 'list':
        // The content already has the list format
        parts.push(block.content);
        break;
      case 'hr':
        parts.push('---');
        break;
      case 'image':
        if (block.metadata?.src) {
          parts.push(`![${block.metadata.alt || ''}](${block.metadata.src})`);
        }
        break;
      default:
        // Regular text paragraph
        parts.push(block.content);
    }
  }
  
  return parts.join('\n\n');
}

export function DocumentViewer({ className, onClose }: DocumentViewerProps) {
  const isDarkMode = useIsDarkMode();
  const codePlugin = isDarkMode ? darkCodePlugin : lightCodePlugin;
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { parsedContent, sourceTitle, slides, progress } = useReaderStore();
  
  // Build markdown content for display
  const markdownContent = useMemo(() => {
    if (!parsedContent) {
      // For plain text, just return the text from slides
      if (slides.length === 0) return '';
      return slides.map(s => s.text).join(' ');
    }
    
    // Add title if present
    let content = '';
    if (sourceTitle && !parsedContent.blocks.some(b => b.type === 'heading' && b.content === sourceTitle)) {
      content = `# ${sourceTitle}\n\n`;
    }
    
    content += reconstructMarkdown(parsedContent);
    return content;
  }, [parsedContent, sourceTitle, slides]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // WORKAROUND: Escape $$ in code blocks
  const safeContent = markdownContent.replace(/\$\$/g, '$\u200B$');
  
  const currentProgress = progress();

  return (
    <div 
      ref={containerRef}
      className={cn(
        'fixed inset-0 z-50 bg-background overflow-y-auto',
        className
      )}
    >
      {/* Header with progress - sticky within the scroll container */}
      <div className="sticky top-0 z-10 bg-background border-b">
        {/* Reading progress bar */}
        {slides.length > 0 && (
          <Progress value={currentProgress} className="h-1 rounded-none" />
        )}
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Reader
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-muted-foreground truncate max-w-[200px] sm:max-w-[400px]">
              {sourceTitle || 'Document'}
            </h2>
            {slides.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {Math.round(currentProgress)}% read
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Document content */}
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <article className="prose prose-neutral dark:prose-invert max-w-none streamdown-container pb-24">
          <Streamdown 
            key={isDarkMode ? 'dark' : 'light'}
            plugins={{ code: codePlugin }}
          >
            {safeContent}
          </Streamdown>
        </article>
      </div>
    </div>
  );
}
