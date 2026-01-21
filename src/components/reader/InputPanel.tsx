'use client';

import { useState } from 'react';
import { FileText, Link, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useReaderStore } from '@/stores/reader-store';
import { cn } from '@/lib/utils';
import { extractEbookText, isEbookFile } from '@/lib/parsers/ebook';
import { parseMarkdown, isMarkdown } from '@/lib/parsers/markdown';

interface InputPanelProps {
  className?: string;
}

export function InputPanel({ className }: InputPanelProps) {
  const {
    inputMode,
    inputText,
    inputUrl,
    state,
    setInputMode,
    setInputText,
    setInputUrl,
    loadText,
    loadContent,
  } = useReaderStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTextSubmit = () => {
    if (inputText.trim()) {
      // Check if content is markdown and parse it
      if (isMarkdown(inputText)) {
        const parsed = parseMarkdown(inputText);
        loadContent(parsed);
      } else {
        loadText(inputText);
      }
    }
  };

  const handleUrlSubmit = async () => {
    if (!inputUrl.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Call our API route to fetch and parse the URL
      const response = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch URL');
      }

      const data = await response.json();
      
      if (data.content) {
        loadText(data.content, data.title);
      } else {
        throw new Error('No content found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch URL');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension

      if (isEbookFile(file)) {
        // Handle ebook files (EPUB, MOBI, AZW3, FB2) using client-side parser
        const text = await extractEbookText(file);
        if (text) {
          loadText(text, fileName);
        } else {
          throw new Error('Could not extract text from ebook');
        }
      } else if (extension === 'md') {
        // Handle markdown files - parse for code blocks, tables, etc.
        const text = await file.text();
        setInputText(text);
        const parsed = parseMarkdown(text);
        parsed.title = parsed.title || fileName;
        loadContent(parsed);
      } else if (extension === 'txt') {
        // Handle plain text files
        const text = await file.text();
        setInputText(text);
        loadText(text, fileName);
      } else {
        throw new Error('Unsupported file type. Use .txt, .md, .epub, .mobi, .azw3, or .fb2');
      }
    } catch (err) {
      console.error('File upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to read file');
    } finally {
      setIsLoading(false);
    }
  };

  const sampleText = `# Speed Reading Guide

Speed reading is a valuable skill that can dramatically increase your reading efficiency. By training your brain to process words faster and eliminate subvocalization, you can potentially double or triple your reading speed.

## How It Works

This application uses **RSVP** (Rapid Serial Visual Presentation) technology to present words one at a time at a fixed focal point. This eliminates eye movement and enables faster reading.

| Feature | Description |
|---------|-------------|
| ORP Highlighting | The optimal recognition point is highlighted |
| Smart Timing | Common words shown faster, rare words slower |
| Code Blocks | Technical content displayed as blocks |

## Code Example

Here's how the timing algorithm works:

\`\`\`typescript
function calculateDuration(word: string, wpm: number): number {
  const baseTime = 60000 / wpm;
  const lengthFactor = word.length > 8 ? 1.5 : 1;
  return baseTime * lengthFactor;
}
\`\`\`

## Tips for Better Reading

- Start at a comfortable speed (250-300 WPM)
- Gradually increase as you adapt
- Take breaks every 20 minutes
- Use the Word Frequency algorithm for technical content

> "The more you read, the more things you will know. The more that you learn, the more places you'll go." - Dr. Seuss

Try adjusting the WPM setting to find your optimal reading speed!`;

  return (
    <div className={cn('space-y-4', className)}>
      <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as typeof inputMode)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="text" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Text
          </TabsTrigger>
          <TabsTrigger value="url" className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            URL
          </TabsTrigger>
          <TabsTrigger value="file" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            File
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="space-y-4">
          <Textarea
            placeholder="Paste or type your text here..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button 
              onClick={handleTextSubmit}
              disabled={!inputText.trim() || state === 'loading'}
              className="flex-1"
            >
              Start Reading
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                setInputText(sampleText);
              }}
            >
              Load Sample
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="url" className="space-y-4">
          <div className="space-y-2">
            <Input
              type="url"
              placeholder="https://example.com/article or raw markdown URL"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Supports articles, blog posts, and raw markdown/text URLs
            </p>
          </div>
          <Button 
            onClick={handleUrlSubmit}
            disabled={!inputUrl.trim() || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Fetching...
              </>
            ) : (
              'Fetch & Start Reading'
            )}
          </Button>
        </TabsContent>

        <TabsContent value="file" className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <input
              type="file"
              id="file-upload"
              accept=".txt,.md,.epub,.mobi,.azw3,.azw,.kf8,.fb2"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label 
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Click to upload or drag and drop
              </span>
              <span className="text-xs text-muted-foreground">
                .txt, .md, .epub, .mobi, .azw3, .fb2
              </span>
            </label>
          </div>
          {isLoading && (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing file...</span>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}
