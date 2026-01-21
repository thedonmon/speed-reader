'use client';

import { BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReaderStore } from '@/stores/reader-store';
import { formatRelativeTime } from '@/lib/storage/reading-progress';

export function ResumePrompt() {
  const { savedProgress, resumeFromSaved, dismissSavedProgress } = useReaderStore();

  if (!savedProgress || savedProgress.progress >= 100) {
    return null;
  }

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <BookOpen className="h-5 w-5 text-primary shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Continue reading?</p>
          <p className="text-muted-foreground">
            {savedProgress.progress}% complete ({formatRelativeTime(savedProgress.lastRead)})
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button 
          size="sm" 
          onClick={resumeFromSaved}
        >
          Resume
        </Button>
        <Button 
          size="sm" 
          variant="ghost"
          onClick={dismissSavedProgress}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
