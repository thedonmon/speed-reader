# AI Agent Guidelines for SkimReaper

## Project Overview
SkimReaper is a speed reading web application built with Next.js that uses RSVP (Rapid Serial Visual Presentation) to display content word-by-word with ORP (Optimal Recognition Point) highlighting.

## Package Manager
**Always use `pnpm`** for all package operations:
```bash
pnpm install        # Install dependencies
pnpm add <pkg>      # Add a package
pnpm remove <pkg>   # Remove a package
pnpm dev            # Start dev server
pnpm build          # Production build
pnpm lint           # Run ESLint
```

## Tech Stack
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand (with persist middleware)
- **UI Components**: Radix UI primitives via shadcn/ui
- **Markdown Rendering**: Streamdown with Shiki code highlighting

## Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   └── page.tsx           # Main page component
├── components/
│   ├── reader/            # Core reader components
│   └── ui/                # shadcn/ui components
├── hooks/                 # Custom React hooks
├── lib/
│   ├── engine/            # Speed reading engine (tokenizer, timing)
│   ├── parsers/           # Content parsers (markdown, ebook)
│   └── storage/           # LocalStorage utilities
└── stores/                # Zustand stores
```

## Key Conventions

### Component Patterns
- Use `'use client'` directive for client components
- Prefer function components with hooks
- Use `cn()` utility from `@/lib/utils` for conditional classNames

### State Management
- Global reader state lives in `src/stores/reader-store.ts`
- Use Zustand selectors to avoid unnecessary re-renders
- Settings are persisted to localStorage

### Styling
- Use Tailwind utility classes
- Follow existing component patterns from shadcn/ui
- Support dark/light mode via `next-themes`

### Content Flow
1. Input (text/URL/file) -> InputPanel
2. Parse content (markdown detection, ebook extraction)
3. Process into slides via engine (tokenization, timing)
4. Display via WordDisplay with ORP highlighting
5. Playback controlled by PlaybackEngine

## Testing Changes
Always verify changes with:
```bash
pnpm build          # Ensure production build passes
pnpm lint           # Check for lint errors
```

## Common Gotchas
- `useSearchParams()` requires Suspense boundary in Next.js App Router
- Streamdown has issues with `$$` in code blocks (workaround: insert zero-width space)
- Touch gestures must check for interactive elements to avoid double-triggering
