// lib/blog/naverBlog.ts
import Parser from "rss-parser";

export const NAVER_BLOG_RSS_URLS = [
  process.env.NAVER_BLOG_RSS_URL,
  process.env.NAVER_BLOG_RSS_URL_1,
  process.env.NAVER_BLOG_RSS_URL_2,
  process.env.NAVER_BLOG_RSS_URL_3,
]
  .filter((url): url is string => Boolean(url && !url.includes("your_blog_id")))
  .filter((url, index, arr) => arr.indexOf(url) === index);

export const MAX_POSTS = 12;

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
  tag?: string;
  "media:content"?: { $?: { url?: string } };
  "media:thumbnail"?: { $?: { url?: string } };
  enclosure?: { url?: string };
};

type ParsedItem = CustomItem & {
  __source: string;
  __channelThumbnail: string | null;
};

type CustomFeed = {
  items?: CustomItem[];
  image?: CustomImage;
};

export function stripHtml(html: string): string {
  return html
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateText(text: string, maxLength = 90): string {
  const clean = stripHtml(text);
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength).trimEnd() + "…";
}

export function formatDateKo(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function extractFirstImage(html: string): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

export function getBlogSourceLabel(rssUrl: string): string {
  try {
    const last = rssUrl.split("/").pop()?.trim();
    return last || "naver-blog";
  } catch {
    return "naver-blog";
  }
}

export function isLikelyImageUrl(url?: string | null): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url);
}

export function normalizeCategory(category?: string | string[]): string {
  if (Array.isArray(category)) {
    return category.find(Boolean)?.trim() ?? "기타";
  }
  return category?.trim() ?? "기타";
}

export function normalizeTags(tag?: string): string[] {
  if (!tag) return [];
  return tag
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

const parser = new Parser<CustomFeed, CustomItem>({
  customFields: {
    item: [
      ["media:content", "media:content"],
      ["media:thumbnail", "media:thumbnail"],
      "enclosure",
      "content",
      "description",
      "category",
      "tag",
    ],
    feed: ["image"],
  },
});

function resolveThumbnail(
  item: CustomItem,
  channelThumbnail: string | null
): string | null {
  const candidates = [
    item["media:thumbnail"]?.$?.url ?? null,
    item["media:content"]?.$?.url ?? null,
    item.enclosure?.url ?? null,
    item.description ? extractFirstImage(item.description) : null,
    item.content ? extractFirstImage(item.content) : null,
    channelThumbnail ?? null,
  ];

  for (const candidate of candidates) {
    if (candidate && isLikelyImageUrl(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function fetchSingleBlogItems(rssUrl: string): Promise<ParsedItem[]> {
  const res = await fetch(rssUrl, {
    next: { revalidate: 3600 },
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; NaverBlogRSSReader/1.0)",
    },
  });

  if (!res.ok) {
    throw new Error(`RSS 응답 오류: ${res.status} ${res.statusText} (${rssUrl})`);
  }

  const xml = await res.text();
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

  try {
    const settled = await Promise.allSettled(
      NAVER_BLOG_RSS_URLS.map((url) => fetchSingleBlogItems(url))
    );

    const successItems = settled
      .filter(
        (result): result is PromiseFulfilledResult<ParsedItem[]> =>
          result.status === "fulfilled"
      )
      .flatMap((result) => result.value);

    if (!successItems.length) {
      return {
        posts: [],
        categories: [],
        error: "현재 소식을 불러올 수 없습니다. 잠시 후 다시 확인해주세요.",
      };
    }

    const normalizedPosts: BlogPost[] = successItems
      .map((item) => {
        const pubDate = item.pubDate ?? item.isoDate ?? "";
        const rawDescription =
          item.contentSnippet ??
          item.description ??
          item.content ??
          item.summary ??
          "";

        return {
          title: stripHtml(item.title ?? "제목 없음"),
          link: item.link ?? "#",
          pubDate,
          formattedDate: formatDateKo(pubDate),
          summary: truncateText(rawDescription, 90),
          thumbnail: resolveThumbnail(item, item.__channelThumbnail) ?? null,
          source: item.__source,
          category: normalizeCategory(item.category),
          tags: normalizeTags(item.tag),
        };
      })
      .sort((a, b) => {
        const aTime = new Date(a.pubDate).getTime();
        const bTime = new Date(b.pubDate).getTime();
        return bTime - aTime;
      });

    const categories = [
      "전체",
      ...Array.from(new Set(normalizedPosts.map((post) => post.category))),
    ];

    const hasFailure = settled.some((result) => result.status === "rejected");

    return {
      posts: normalizedPosts.slice(0, MAX_POSTS),
      categories,
      error: hasFailure
        ? "일부 블로그 데이터를 불러오지 못했지만, 표시 가능한 글만 우선 노출합니다."
        : null,
    };
  } catch (err) {
    console.error("[NaverBlog] RSS 파싱 실패:", err);

    return {
      posts: [],
      categories: [],
      error: "현재 소식을 불러올 수 없습니다. 잠시 후 다시 확인해주세요.",
    };
  }
}