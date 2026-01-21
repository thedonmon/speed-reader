# Speed Reader

A modern RSVP (Rapid Serial Visual Presentation) speed reading web app built with Next.js. Read faster by displaying one word at a time with optimal recognition point (ORP) highlighting.

## Features

- **RSVP Reading** - Words displayed one at a time at configurable speeds (100-1000+ WPM)
- **ORP Highlighting** - Optimal Recognition Point highlighting helps your eyes focus on the right spot
- **Multiple Timing Algorithms**
  - Basic - Fixed timing per word
  - Word Length - Longer words get more time
  - Word Frequency - Common words flash faster, rare words slower
- **Dark Mode** - Full dark/light theme support
- **Focused Reading Mode** - Fullscreen distraction-free reading with auto-hiding controls
- **Touch Gestures** - Swipe left/right to navigate, up/down for speed, tap to play/pause
- **Keyboard Shortcuts** - Space (play/pause), Arrow keys (navigate/speed), R (reset)

### Input Sources

- **Text** - Paste any text directly
- **URL** - Fetch articles from the web (see limitations below)
- **EPUB** - Upload and read ebook files
- **Markdown** - Full markdown support with syntax-highlighted code blocks

## Getting Started

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to start reading.

## URL Fetching Limitations

The URL fetching feature uses [@extractus/article-extractor](https://github.com/niclin/article-extractor) to parse web pages. However, many sites have restrictions that prevent content extraction:

### Sites That Work Well

- GitHub raw files (`raw.githubusercontent.com`)
- GitHub Gists (`gist.githubusercontent.com`)
- Direct links to `.md` or `.txt` files
- Most blog platforms (Medium, Dev.to, personal blogs)
- News sites with standard article markup

### Sites That May Not Work

- **Paywalled content** - Sites requiring login/subscription
- **JavaScript-rendered pages** - SPAs that load content dynamically
- **Bot protection** - Sites with Cloudflare, CAPTCHA, or anti-scraping measures
- **CORS restrictions** - Some sites block cross-origin requests
- **Non-standard markup** - Pages without proper article structure

### Workarounds

If a URL doesn't work, try these alternatives:

1. **Use Reader Mode** - Most browsers have a reader mode (Firefox, Safari, Edge). Copy the cleaned text from there.
2. **Copy-paste** - Select and copy the article text manually
3. **Raw URLs** - For GitHub, use the "Raw" button to get a direct text link
4. **Browser Extensions** - Extensions like "Copy as Markdown" can help extract content

### Future Improvements

Potential enhancements for better URL support:

- Server-side rendering with Puppeteer/Playwright for JS-heavy sites
- Proxy service to bypass CORS restrictions
- Browser extension for direct page access
- Support for more content extraction APIs (Readability, Mercury, etc.)
- Manual HTML selector configuration for specific sites

## Tech Stack

- [Next.js 16](https://nextjs.org/) - React framework
- [Tailwind CSS 4](https://tailwindcss.com/) - Styling
- [Zustand](https://zustand.docs.pmnd.rs/) - State management
- [Streamdown](https://github.com/niclin/streamdown) - Markdown rendering with Shiki syntax highlighting
- [Radix UI](https://www.radix-ui.com/) - Accessible UI components
- [@extractus/article-extractor](https://github.com/niclin/article-extractor) - Web article extraction
- [@lingo-reader/epub-parser](https://github.com/niclin/lingo-reader) - EPUB parsing

## Development

```bash
pnpm dev      # Start dev server
pnpm build    # Production build
pnpm start    # Start production server
pnpm lint     # Run ESLint
```

## License

MIT
