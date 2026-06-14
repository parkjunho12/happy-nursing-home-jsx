// lib/blog/naverBlog.ts
import Parser from "rss-parser";

const RSS_REVALIDATE_SECONDS = 3600;
export const MAX_POSTS = 12;

function normalizeRssUrl(url?: string): string | null {
  if (!url) return null;

  let trimmed = url.trim();

  if (!trimmed) return null;
  if (trimmed.includes("your_blog_id")) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;

  // 네이버 RSS는 .xml까지 붙이는 것이 안정적
  if (
    trimmed.includes("rss.blog.naver.com") &&
    !trimmed.toLowerCase().endsWith(".xml")
  ) {
    trimmed = `${trimmed}.xml`;
  }

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
  url?: unknown;
  title?: unknown;
  link?: unknown;
};

type RssMediaField = {
  $?: {
    url?: unknown;
  };
};

type CustomItem = {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
  isoDate?: unknown;
  summary?: unknown;
  description?: unknown;
  content?: unknown;
  contentSnippet?: unknown;
  category?: unknown;
  categories?: unknown;
  tag?: unknown;
  tags?: unknown;
  "media:content"?: RssMediaField | RssMediaField[];
  "media:thumbnail"?: RssMediaField | RssMediaField[];
  enclosure?: {
    url?: unknown;
    type?: unknown;
  };
};

type ParsedItem = CustomItem & {
  __source: string;
  __channelThumbnail: string | null;
};

type CustomFeed = {
  items?: CustomItem[];
  image?: CustomImage | string;
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

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

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
  const value = asString(html);
  if (!value) return "";

  return decodeHtmlEntities(value)
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

export function formatDateKo(dateString: unknown): string {
  const value = asString(dateString);
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  });
}

export function extractFirstImage(html: unknown): string | null {
  const value = asString(html);
  if (!value) return null;

  const match = value.match(/<img[^>]+src=["']([^"']+)["']/i);
  const src = match?.[1];

  return src ? decodeHtmlEntities(src) : null;
}

export function getBlogSourceLabel(rssUrl: string): string {
  try {
    const url = new URL(rssUrl);
    const fileName = url.pathname.split("/").filter(Boolean).at(-1);

    return fileName?.replace(".xml", "") || url.hostname;
  } catch {
    return "naver-blog";
  }
}

export function isLikelyImageUrl(url?: unknown): url is string {
  if (typeof url !== "string") return false;

  const trimmed = url.trim();

  return /^https?:\/\//i.test(trimmed);
}

function pickMediaUrl(media?: RssMediaField | RssMediaField[]): string | null {
  if (!media) return null;

  const list = Array.isArray(media) ? media : [media];

  const found = list.find((item) => isLikelyImageUrl(item.$?.url))?.$?.url;

  return isLikelyImageUrl(found) ? found : null;
}

function normalizeCategory(category?: unknown): string {
  if (Array.isArray(category)) {
    return (
      category
        .map((value) => stripHtml(value))
        .find((value) => value.length > 0) ?? "기타"
    );
  }

  const clean = stripHtml(category);

  return clean || "기타";
}

function normalizeTags(item: CustomItem): string[] {
  const rawValues: unknown[] = [
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
    item.enclosure?.url,
    extractFirstImage(item.description),
    extractFirstImage(item.content),
    extractFirstImage(item.summary),
    channelThumbnail,
  ];

  const found = candidates.find(isLikelyImageUrl);

  return found ?? null;
}

function normalizePost(item: ParsedItem): BlogPost | null {
  const title = stripHtml(item.title);

  if (!title) return null;

  const pubDate = asString(item.pubDate) ?? asString(item.isoDate) ?? "";

  const rawDescription =
    item.contentSnippet ??
    item.description ??
    item.content ??
    item.summary ??
    "";

  const link = asString(item.link);

  return {
    title,
    link: link && link.trim() ? link : "#",
    pubDate,
    formattedDate: formatDateKo(pubDate),
    summary: truncateText(rawDescription, 90),
    thumbnail: resolveThumbnail(item, item.__channelThumbnail),
    source: item.__source,
    category: normalizeCategory(item.category ?? item.categories),
    tags: normalizeTags(item),
  };
}

function getFeedImageUrl(feed: CustomFeed): string | null {
  if (typeof feed.image === "string") {
    return isLikelyImageUrl(feed.image) ? feed.image : null;
  }

  const imageUrl = feed.image?.url;

  return isLikelyImageUrl(imageUrl) ? imageUrl : null;
}

async function fetchSingleBlogItems(rssUrl: string): Promise<ParsedItem[]> {
  console.log("[NaverBlog] RSS 요청:", rssUrl);

  const res = await fetch(rssUrl, {
    next: { revalidate: RSS_REVALIDATE_SECONDS },
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; HappyNursingHomeRSSReader/1.0)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });

  console.log("[NaverBlog] RSS 응답:", rssUrl, res.status, res.statusText);

  if (!res.ok) {
    throw new Error(`RSS 응답 오류: ${res.status} ${res.statusText} (${rssUrl})`);
  }

  const xml = await res.text();

  console.log("[NaverBlog] RSS XML 길이:", rssUrl, xml.length);

  if (!xml.trim()) {
    throw new Error(`RSS 응답이 비어있습니다. (${rssUrl})`);
  }

  const lowerXml = xml.slice(0, 300).toLowerCase();

  if (lowerXml.includes("<html") || lowerXml.includes("<!doctype html")) {
    throw new Error(
      `RSS가 아니라 HTML이 반환되었습니다. RSS 주소를 확인하세요. (${rssUrl})`
    );
  }

  const feed = await parser.parseString(xml);
  const source = getBlogSourceLabel(rssUrl);
  const channelThumbnail = getFeedImageUrl(feed);

  console.log("[NaverBlog] RSS 파싱 글 개수:", rssUrl, feed.items?.length ?? 0);

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
  console.log("[NaverBlog] 사용 RSS URL 목록:", NAVER_BLOG_RSS_URLS);

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

  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        "[NaverBlog] RSS 실패:",
        NAVER_BLOG_RSS_URLS[index],
        result.reason
      );
    }
  });

  const successItems = settled
    .filter(
      (result): result is PromiseFulfilledResult<ParsedItem[]> =>
        result.status === "fulfilled"
    )
    .flatMap((result) => result.value);

  console.log("[NaverBlog] 성공 item 총 개수:", successItems.length);

  const normalizedPosts = successItems
    .map(normalizePost)
    .filter((post): post is BlogPost => post !== null)
    .sort((a, b) => getSortableTime(b) - getSortableTime(a));

  console.log("[NaverBlog] 정규화 post 총 개수:", normalizedPosts.length);

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
      categories,
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