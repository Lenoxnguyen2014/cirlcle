import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

interface LinkMetadata {
  title?: string;
  description?: string;
  ogImage?: string;
  siteName?: string;
  textSnippet?: string;
}

const fetchLinkMetadata = async (url: string): Promise<LinkMetadata> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'hackathon-travel-board/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('text/html')) {
      return {};
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('meta[property="og:title"]').attr('content') || $('title').text() || undefined;
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      undefined;
    const ogImage = $('meta[property="og:image"]').attr('content') || undefined;
    const siteName = $('meta[property="og:site_name"]').attr('content') || undefined;

    // Isolate the actual article body (same approach as Firefox Reader Mode) so
    // the AI sees the story, not "related articles" / sidebar / trending widgets
    // that mention unrelated places and aren't caught by a plain tag strip.
    let textSnippet: string | undefined;
    try {
      const dom = new JSDOM(html, { url });
      const article = new Readability(dom.window.document).parse();
      textSnippet = article?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 6000) || undefined;
    } catch {
      textSnippet = undefined;
    }

    if (!textSnippet) {
      $('script, style, noscript, nav, footer, header, aside').remove();
      textSnippet = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 6000) || undefined;
    }

    return { title, description, ogImage, siteName, textSnippet };
  } catch (error: any) {
    console.error('Error in fetchLinkMetadata:', error.message);
    return {};
  }
};

export { fetchLinkMetadata };
export type { LinkMetadata };
