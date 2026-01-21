'use client';

import { useReaderStore } from '@/stores/reader-store';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  className?: string;
}

export function SettingsPanel({ className }: SettingsPanelProps) {
  const { settings, updateSettings } = useReaderStore();

  return (
    <div className={cn('space-y-6', className)}>
      {/* Algorithm */}
      <div className="space-y-2">
        <Label>Timing Algorithm</Label>
        <Select
          value={settings.algorithm}
          onValueChange={(value) => 
            updateSettings({ algorithm: value as typeof settings.algorithm })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="basic">Basic (Fixed WPM)</SelectItem>
            <SelectItem value="wordLength">Word Length</SelectItem>
            <SelectItem value="wordFrequency">Word Frequency (Shannon)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {settings.algorithm === 'basic' && 'All words shown for equal time'}
          {settings.algorithm === 'wordLength' && 'Longer words shown longer'}
          {settings.algorithm === 'wordFrequency' && 'Rare words shown longer for better comprehension'}
        </p>
      </div>

      <Separator />

      {/* Text Position */}
      <div className="space-y-2">
        <Label>Text Position</Label>
        <Select
          value={settings.textPosition}
          onValueChange={(value) => 
            updateSettings({ textPosition: value as typeof settings.textPosition })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="centered">Centered</SelectItem>
            <SelectItem value="left">Left Aligned</SelectItem>
            <SelectItem value="optimal">Optimal (ORP)</SelectItem>
            <SelectItem value="optimalWithFocal">Optimal + Focal Point</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Chunk Size */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label>Words per Slide</Label>
          <span className="text-sm text-muted-foreground">{settings.chunkSize}</span>
        </div>
        <Slider
          value={[settings.chunkSize]}
          onValueChange={([value]) => updateSettings({ chunkSize: value })}
          min={1}
          max={5}
          step={1}
        />
      </div>

      <Separator />

      {/* Font Settings */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Font</Label>
          <Select
            value={settings.font}
            onValueChange={(value) => updateSettings({ font: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system-ui">System Default</SelectItem>
              <SelectItem value="Georgia">Georgia (Serif)</SelectItem>
              <SelectItem value="Arial">Arial (Sans)</SelectItem>
              <SelectItem value="Verdana">Verdana</SelectItem>
              <SelectItem value="monospace">Monospace</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Font Size</Label>
            <span className="text-sm text-muted-foreground">{settings.fontSize}px</span>
          </div>
          <Slider
            value={[settings.fontSize]}
            onValueChange={([value]) => updateSettings({ fontSize: value })}
            min={24}
            max={96}
            step={4}
          />
        </div>
      </div>

      <Separator />

      {/* Highlighting */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="highlight-toggle">Highlight Optimal Letter</Label>
          <Switch
            id="highlight-toggle"
            checked={settings.highlightOptimalLetter}
            onCheckedChange={(checked) => 
              updateSettings({ highlightOptimalLetter: checked })
            }
          />
        </div>

        {settings.highlightOptimalLetter && (
          <div className="space-y-2">
            <Label>Highlight Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.highlightColor}
                onChange={(e) => updateSettings({ highlightColor: e.target.value })}
                className="w-12 h-10 p-1"
              />
              <Input
                value={settings.highlightColor}
                onChange={(e) => updateSettings({ highlightColor: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Pause Settings */}
      <div className="space-y-4">
        <h4 className="font-medium">Pauses</h4>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="pause-comma">After Comma</Label>
            <Switch
              id="pause-comma"
              checked={settings.pauseAfterComma}
              onCheckedChange={(checked) => 
                updateSettings({ pauseAfterComma: checked })
              }
            />
          </div>
          {settings.pauseAfterComma && (
            <div className="flex items-center gap-2 ml-4">
              <Slider
                value={[settings.pauseAfterCommaDelay]}
                onValueChange={([value]) => 
                  updateSettings({ pauseAfterCommaDelay: value })
                }
                min={50}
                max={1000}
                step={50}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground w-16 text-right">
                {settings.pauseAfterCommaDelay}ms
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="pause-period">After Period</Label>
            <Switch
              id="pause-period"
              checked={settings.pauseAfterPeriod}
              onCheckedChange={(checked) => 
                updateSettings({ pauseAfterPeriod: checked })
              }
            />
          </div>
          {settings.pauseAfterPeriod && (
            <div className="flex items-center gap-2 ml-4">
              <Slider
                value={[settings.pauseAfterPeriodDelay]}
                onValueChange={([value]) => 
                  updateSettings({ pauseAfterPeriodDelay: value })
                }
                min={100}
                max={1500}
                step={50}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground w-16 text-right">
                {settings.pauseAfterPeriodDelay}ms
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="pause-para">After Paragraph</Label>
            <Switch
              id="pause-para"
              checked={settings.pauseAfterParagraph}
              onCheckedChange={(checked) => 
                updateSettings({ pauseAfterParagraph: checked })
              }
            />
          </div>
          {settings.pauseAfterParagraph && (
            <div className="flex items-center gap-2 ml-4">
              <Slider
                value={[settings.pauseAfterParagraphDelay]}
                onValueChange={([value]) => 
                  updateSettings({ pauseAfterParagraphDelay: value })
                }
                min={200}
                max={2000}
                step={100}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground w-16 text-right">
                {settings.pauseAfterParagraphDelay}ms
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Word Frequency Algorithm Settings */}
      {settings.algorithm === 'wordFrequency' && (
        <>
          <Separator />
          <div className="space-y-4">
            <h4 className="font-medium">Word Frequency Settings</h4>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Common Word Duration</Label>
                <span className="text-sm text-muted-foreground">
                  {settings.wordFreqHighDuration}ms
                </span>
              </div>
              <Slider
                value={[settings.wordFreqHighDuration]}
                onValueChange={([value]) => 
                  updateSettings({ wordFreqHighDuration: value })
                }
                min={20}
                max={200}
                step={10}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Rare Word Duration</Label>
                <span className="text-sm text-muted-foreground">
                  {settings.wordFreqLowDuration}ms
                </span>
              </div>
              <Slider
                value={[settings.wordFreqLowDuration]}
                onValueChange={([value]) => 
                  updateSettings({ wordFreqLowDuration: value })
                }
                min={100}
                max={1000}
                step={50}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
