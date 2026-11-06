/**
 * 8 Of Spades Works — Tavily Search Client
 * Real-time web search and multimedia discovery engine.
 */

export interface TavilySearchResultItem {
  title: string;
  url: string;
  content: string;
  score: number;
  rawContent?: string;
}

export interface TavilySearchResponse {
  query: string;
  results: TavilySearchResultItem[];
  images: string[];
  answer?: string;
  response_time?: number;
}

export interface TavilySearchOptions {
  searchDepth?: 'basic' | 'advanced';
  includeImages?: boolean;
  includeAnswer?: boolean;
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
}

export class TavilySearchClient {
  private static readonly API_ENDPOINT = 'https://api.tavily.com/search';

  public static getApiKey(): string {
    const key =
      process.env.TAVILY_API_KEY ||
      process.env.NEXT_PUBLIC_TAVILY_API_KEY ||
      '';
    return key.trim();
  }

  /**
   * Executes a search query via Tavily API
   */
  public static async search(
    query: string,
    options: TavilySearchOptions = {}
  ): Promise<TavilySearchResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Tavily API key is missing. Set TAVILY_API_KEY in .env.local.');
    }

    const payload: Record<string, any> = {
      api_key: apiKey,
      query,
      search_depth: options.searchDepth || 'advanced',
      include_images: options.includeImages !== false, // default true for cover art discovery
      include_answer: Boolean(options.includeAnswer),
      max_results: options.maxResults || 8,
    };

    if (options.includeDomains && options.includeDomains.length > 0) {
      payload.include_domains = options.includeDomains;
    }
    if (options.excludeDomains && options.excludeDomains.length > 0) {
      payload.exclude_domains = options.excludeDomains;
    }

    const res = await fetch(this.API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`Tavily search failed (${res.status}): ${errorText || res.statusText}`);
    }

    const data = await res.json();
    return {
      query,
      results: Array.isArray(data.results) ? data.results : [],
      images: Array.isArray(data.images) ? data.images : [],
      answer: data.answer,
      response_time: data.response_time,
    };
  }
}
