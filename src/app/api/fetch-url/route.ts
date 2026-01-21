import { NextRequest, NextResponse } from 'next/server';
import { extract } from '@extractus/article-extractor';
import { convert } from '@kreuzberg/html-to-markdown-wasm';

// Common browser user agent to avoid bot detection
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 15000;

/**
 * Convert HTML to Markdown using kreuzberg's high-performance converter
 * Handles tables, code blocks, strikethrough, and more out of the box
 */
function htmlToMarkdown(html: string): string {
  return convert(html, {
    headingStyle: 'atx',  // Use # style headings
  });
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    let fetchUrl = url;

    // Convert GitHub blob URLs to raw URLs
    // e.g., github.com/user/repo/blob/branch/path/file.md -> raw.githubusercontent.com/user/repo/branch/path/file.md
    const githubBlobMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)/);
    if (githubBlobMatch) {
      const [, user, repo, rest] = githubBlobMatch;
      fetchUrl = `https://raw.githubusercontent.com/${user}/${repo}/${rest}`;
    }

    // Check if it's a raw content URL (github raw, gist, etc.)
    const isRawUrl = 
      fetchUrl.includes('raw.githubusercontent.com') ||
      fetchUrl.includes('gist.githubusercontent.com') ||
      fetchUrl.endsWith('.md') ||
      fetchUrl.endsWith('.txt');

    if (isRawUrl) {
      // Fetch raw content directly with timeout
      const response = await fetch(fetchUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      let content = await response.text();
      
      // If content looks like HTML (not markdown), convert to markdown
      const looksLikeHtml = content.trim().startsWith('<!') || 
                           content.trim().startsWith('<html') ||
                           (content.includes('</div>') && !content.includes('```'));
      
      if (looksLikeHtml) {
        // Convert HTML to Markdown (handles script/style removal internally)
        content = htmlToMarkdown(content);
      }
      
      return NextResponse.json({
        title: fetchUrl.split('/').pop() || 'Document',
        content,
        source: url,
      });
    }

    // Use article extractor for web pages with custom headers and timeout
    const article = await extract(fetchUrl, {}, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!article) {
      return NextResponse.json(
        { error: 'Could not extract article content' },
        { status: 400 }
      );
    }

    // Convert HTML content to Markdown (preserves headings, links, code blocks, tables, etc.)
    let content = htmlToMarkdown(article.content || '');

    // Prepend title as H1 if available
    if (article.title) {
      content = `# ${article.title}\n\n${content}`;
    }

    return NextResponse.json({
      title: article.title,
      content,
      source: url,
      author: article.author,
    });
  } catch (error) {
    console.error('Fetch URL error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch URL' },
      { status: 500 }
    );
  }
}
