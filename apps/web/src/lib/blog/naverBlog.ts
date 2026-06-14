// lib/blog/naverBlog.ts
import Parser from "rss-parser";

const RSS_REVALIDATE_SECONDS = 3600;
export const MAX_POSTS = 12;

function normalizeRssUrl(url?: string): string | null {
  if (!url) return null;

  const trimmed = url.trim();

  if (!trimmed) return null;
  if (trimmed.includes("your_blog_id")) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;

  return trimmed;
}

export const NAVER_BLOG_RSS_URLS = [
  process.env.NAVER_BLOG_RSS_URL,
  process.env.NAVER_BLOG_RSS_URL_1,
  process.env.NAVER_BLOG_RSS_URL_2,
  process.env.NAVER_BLOG_RSS_URL_3,
]
  .map(normalizeRssUrl)
  .filter((url): url is string => Boolean(url))
  .filter((url, index, arr) => arr.indexOf(url) === index);

export interface BlogPost {
  title: string;
  link: string;
  pubDate: string;
  formattedDate: string;
  summary: string;
  thumbnail: string | null;
  source: string;
  category: string;
  tags: string[];
}

type CustomImage = {
  url?: string;
  title?: string;
  link?: string;
};

type RssMediaField = {
  $?: {
    url?: string;
  };
};

type CustomItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  summary?: string;
  description?: string;
  content?: string;
  contentSnippet?: string;
  category?: string | string[];
  categories?: string[];
  tag?: string;
  tags?: string[];
  "media:content"?: RssMediaField | RssMediaField[];
  "media:thumbnail"?: RssMediaField | RssMediaField[];
  enclosure?: {
    url?: string;
    type?: string;
  };
};

type ParsedItem = CustomItem & {
  __source: string;
  __channelThumbnail: string | null;
};

type CustomFeed = {
  items?: CustomItem[];
  image?: CustomImage;
  title?: string;
  link?: string;
};

const parser = new Parser<CustomFeed, CustomItem>({
  customFields: {
    item: [
      ["media:content", "media:content"],
      ["media:thumbnail", "media:thumbnail"],
      "enclosure",
      "content",
      "description",
      "category",
      "categories",
      "tag",
      "tags",
    ],
    feed: ["image"],
  },
});

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

export function stripHtml(html: unknown): string {
  if (typeof html !== "string") return "";

  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateText(text: unknown, maxLength = 90): string {
  const clean = stripHtml(text);

  if (!clean) return "";
  if (clean.length <= maxLength) return clean;

  return `${clean.slice(0, maxLength).trimEnd()}…`;
}

export function formatDateKo(dateString: string): string {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  });
}

export function extractFirstImage(html?: string): string | null {
  if (!html) return null;

  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  const src = match?.[1];

  return src ? decodeHtmlEntities(src) : null;
}

export function getBlogSourceLabel(rssUrl: string): string {
  try {
    const url = new URL(rssUrl);
    const pathParts = url.pathname.split("/").filter(Boolean);
    return pathParts.at(-1) ?? url.hostname;
  } catch {
    return "naver-blog";
  }
}

export function isLikelyImageUrl(url?: string | null): boolean {
  if (!url) return false;

  const trimmed = url.trim();

  if (!/^https?:\/\//i.test(trimmed)) return false;

  return true;
}

function pickMediaUrl(media?: RssMediaField | RssMediaField[]): string | null {
  if (!media) return null;

  const list = Array.isArray(media) ? media : [media];

  return list.find((item) => isLikelyImageUrl(item.$?.url))?.$?.url ?? null;
}

function normalizeCategory(category?: string | string[] | unknown): string {
  if (Array.isArray(category)) {
    return (
      category
        .map((value) => (typeof value === "string" ? stripHtml(value) : ""))
        .find(Boolean) ?? "기타"
    );
  }

  if (typeof category === "string") {
    return stripHtml(category) || "기타";
  }

  return "기타";
}

function normalizeTags(item: CustomItem): string[] {
  const rawValues = [
    item.tag,
    ...(Array.isArray(item.tags) ? item.tags : []),
    ...(Array.isArray(item.categories) ? item.categories : []),
    ...(Array.isArray(item.category) ? item.category : []),
  ];

  return Array.from(
    new Set(
      rawValues
        .filter((value): value is string => typeof value === "string")
        .flatMap((value) => value.split(","))
        .map(stripHtml)
        .filter(Boolean)
    )
  );
}

function getSortableTime(post: BlogPost): number {
  const time = new Date(post.pubDate).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function resolveThumbnail(
  item: CustomItem,
  channelThumbnail: string | null
): string | null {
  const candidates = [
    pickMediaUrl(item["media:thumbnail"]),
    pickMediaUrl(item["media:content"]),
    item.enclosure?.url ?? null,
    extractFirstImage(item.description),
    extractFirstImage(item.content),
    extractFirstImage(item.summary),
    channelThumbnail,
  ];

  const image = candidates.find(isLikelyImageUrl);

  return image ?? null;
}

function normalizePost(item: ParsedItem): BlogPost | null {
  const title = stripHtml(item.title ?? "");

  if (!title) return null;

  const pubDate = item.pubDate ?? item.isoDate ?? "";

  const rawDescription =
    item.contentSnippet ??
    item.description ??
    item.content ??
    item.summary ??
    "";

  return {
    title,
    link: typeof item.link === "string" && item.link.trim() ? item.link : "#",
    pubDate,
    formattedDate: formatDateKo(pubDate),
    summary: truncateText(rawDescription, 90),
    thumbnail: resolveThumbnail(item, item.__channelThumbnail),
    source: item.__source,
    category: normalizeCategory(item.category ?? item.categories),
    tags: normalizeTags(item),
  };
}

async function fetchSingleBlogItems(rssUrl: string): Promise<ParsedItem[]> {
  const res = await fetch(rssUrl, {
    next: { revalidate: RSS_REVALIDATE_SECONDS },
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; HappyNursingHomeRSSReader/1.0)",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });

  if (!res.ok) {
    throw new Error(`RSS 응답 오류: ${res.status} ${res.statusText} (${rssUrl})`);
  }

  const xml = await res.text();

  if (!xml.trim()) {
    throw new Error(`RSS 응답이 비어있습니다. (${rssUrl})`);
  }

  const feed = await parser.parseString(xml);
  const source = getBlogSourceLabel(rssUrl);

  const channelThumbnail =
    feed.image?.url && isLikelyImageUrl(feed.image.url) ? feed.image.url : null;

  return (feed.items ?? []).map((item) => ({
    ...item,
    __source: source,
    __channelThumbnail: channelThumbnail,
  }));
}

export async function getNaverBlogPosts(): Promise<{
  posts: BlogPost[];
  categories: string[];
  error: string | null;
}> {
  if (!NAVER_BLOG_RSS_URLS.length) {
    return {
      posts: [],
      categories: [],
      error: "RSS URL이 설정되지 않았습니다. 환경변수를 확인하세요.",
    };
  }

  const settled = await Promise.allSettled(
    NAVER_BLOG_RSS_URLS.map((url) => fetchSingleBlogItems(url))
  );

  const successItems = settled
    .filter(
      (result): result is PromiseFulfilledResult<ParsedItem[]> =>
        result.status === "fulfilled"
    )
    .flatMap((result) => result.value);

  const normalizedPosts = successItems
    .map(normalizePost)
    .filter((post): post is BlogPost => post !== null)
    .sort((a, b) => getSortableTime(b) - getSortableTime(a));

  const categories = [
    "전체",
    ...Array.from(new Set(normalizedPosts.map((post) => post.category))).filter(
      Boolean
    ),
  ];

  const hasFailure = settled.some((result) => result.status === "rejected");

  if (!normalizedPosts.length) {
    return {
      posts: [],
      categories: [],
      error: hasFailure
        ? "블로그 RSS 데이터를 불러오지 못했습니다. RSS 주소 또는 네이버 블로그 공개 상태를 확인해주세요."
        : "현재 등록된 블로그 글이 없습니다.",
    };
  }

  return {
    posts: normalizedPosts.slice(0, MAX_POSTS),
    categories,
    error: hasFailure
      ? "일부 블로그 데이터를 불러오지 못했지만, 표시 가능한 글만 우선 노출합니다."
      : null,
  };
}