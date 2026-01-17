export interface ICrawler {
  name: string;
  crawl(): Promise<{ imageBase64: string; url: string }>;
}

export interface CrawlerResult {
  success: boolean;
  image?: string; // base64
  url?: string;
  error?: string;
  isMock?: boolean;
}
