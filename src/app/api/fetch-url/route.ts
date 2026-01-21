import { NextRequest, NextResponse } from 'next/server';
import { extract } from '@extractus/article-extractor';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Check if it's a raw content URL (github raw, gist, etc.)
    const isRawUrl = 
      url.includes('raw.githubusercontent.com') ||
      url.includes('gist.githubusercontent.com') ||
      url.endsWith('.md') ||
      url.endsWith('.txt');

    if (isRawUrl) {
      // Fetch raw content directly
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      const content = await response.text();
      
      return NextResponse.json({
        title: url.split('/').pop() || 'Document',
        content,
        source: url,
      });
    }

    // Use article extractor for web pages
    const article = await extract(url);

    if (!article) {
      return NextResponse.json(
        { error: 'Could not extract article content' },
        { status: 400 }
      );
    }

    // Clean up the content - remove HTML tags for plain text
    let content = article.content || '';
    
    // Basic HTML stripping (the extractor returns HTML)
    content = content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    // Prepend title if available
    if (article.title) {
      content = `${article.title}\n\n${content}`;
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
