// lib/naverBlog.ts
// 네이버 블로그 RSS를 가져오고 파싱하는 핵심 유틸 모듈
// - 여러 블로그 RSS 지원
// - 최신순 병합 정렬
// - item.description 내부 <img> 썸네일 추출 지원
// - 채널 기본 이미지 fallback 지원
// - 출처 블로그 식별 source 포함

import Parser from "rss-parser";

// ─────────────────────────────────────────────
// 1. 상수 / 환경변수
// ─────────────────────────────────────────────

/**
 * 네이버 블로그 RSS URL 목록
 * 환경변수 예시:
 * NAVER_BLOG_RSS_URL=https://rss.blog.naver.com/blog_id_main
 * NAVER_BLOG_RSS_URL_1=https://rss.blog.naver.com/blog_id_1
 * NAVER_BLOG_RSS_URL_2=https://rss.blog.naver.com/blog_id_2
 * NAVER_BLOG_RSS_URL_3=https://rss.blog.naver.com/blog_id_3
 */
export const NAVER_BLOG_RSS_URLS = [
  process.env.NAVER_BLOG_RSS_URL,
  process.env.NAVER_BLOG_RSS_URL_1,
  process.env.NAVER_BLOG_RSS_URL_2,
  process.env.NAVER_BLOG_RSS_URL_3,
]
  .filter((url): url is string => Boolean(url && !url.includes("your_blog_id")))
  .filter((url, index, arr) => arr.indexOf(url) === index); // 중복 제거

/** 메인 페이지에 노출할 최대 글 수 */
export const MAX_POSTS = 6;

// ─────────────────────────────────────────────
// 2. 타입 정의
// ─────────────────────────────────────────────

export interface BlogPost {
  title: string;
  link: string;
  pubDate: string;
  formattedDate: string;
  summary: string;
  thumbnail: string | null;
  source: string;
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
  "media:content"?: { $?: { url?: string } };
  "media:thumbnail"?: { $?: { url?: string } };
  enclosure?: { url?: string };
};

type ParsedItem = CustomItem & {
  __source: string;
  __channelThumbnail: string | null;
};

// feed 전체 타입
type CustomFeed = {
  items?: CustomItem[];
  image?: CustomImage;
};

// ─────────────────────────────────────────────
// 3. 유틸 함수
// ─────────────────────────────────────────────

/**
 * HTML 태그 및 특수문자 엔티티 제거
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<img[^>]*>/gi, " ") // img 먼저 제거
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

/**
 * 텍스트를 최대 n자로 자르고 말줄임표 추가
 */
export function truncateText(text: string, maxLength = 90): string {
  const clean = stripHtml(text);
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength).trimEnd() + "…";
}

/**
 * ISO 날짜 문자열을 한국식으로 포맷
 */
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

/**
 * HTML 문자열에서 첫 번째 <img> src 추출
 */
export function extractFirstImage(html: string): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

/**
 * RSS URL에서 블로그 식별용 텍스트 추출
 * 예: https://rss.blog.naver.com/happy_8090 -> happy_8090
 */
export function getBlogSourceLabel(rssUrl: string): string {
  try {
    const last = rssUrl.split("/").pop()?.trim();
    return last || "naver-blog";
  } catch {
    return "naver-blog";
  }
}

/**
 * URL이 이미지 URL로 보여지는지 단순 확인
 */
export function isLikelyImageUrl(url?: string | null): boolean {
  if (!url) return false;

  return /^https?:\/\//i.test(url);
}

// ─────────────────────────────────────────────
// 4. RSS 파서 설정
// ─────────────────────────────────────────────

const parser = new Parser<CustomFeed, CustomItem>({
  customFields: {
    item: [
      ["media:content", "media:content"],
      ["media:thumbnail", "media:thumbnail"],
      "enclosure",
      "content",
      "description",
    ],
    feed: ["image"],
  },
});

/**
 * 게시글 썸네일 추출
 * 우선순위:
 * 1. media:thumbnail
 * 2. media:content
 * 3. enclosure
 * 4. description 안 첫 번째 img
 * 5. content 안 첫 번째 img
 * 6. 채널 기본 이미지
 * 7. null
 */
function resolveThumbnail(
  item: CustomItem,
  channelThumbnail: string | null
): string | null {
  const candidates = [
    item["media:thumbnail"]?.$?.url,
    item["media:content"]?.$?.url,
    item.enclosure?.url,
    item.description ? extractFirstImage(item.description) : null,
    item.content ? extractFirstImage(item.content) : null,
    channelThumbnail,
  ];

  for (const candidate of candidates) {
    if (isLikelyImageUrl(candidate)) {
      return candidate!;
    }
  }

  return null;
}

// ─────────────────────────────────────────────
// 5. RSS 하나 가져오기
// ─────────────────────────────────────────────

async function fetchSingleBlogItems(rssUrl: string): Promise<ParsedItem[]> {
  const res = await fetch(rssUrl, {
    next: { revalidate: 3600 }, // 1시간 캐싱
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

// ─────────────────────────────────────────────
// 6. 여러 RSS 병합
// ─────────────────────────────────────────────

export async function getNaverBlogPosts(): Promise<{
  posts: BlogPost[];
  error: string | null;
}> {
  if (!NAVER_BLOG_RSS_URLS.length) {
    return {
      posts: [],
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
        error: "현재 소식을 불러올 수 없습니다. 잠시 후 다시 확인해주세요.",
      };
    }

    const posts: BlogPost[] = successItems
      .sort((a, b) => {
        const aTime = new Date(a.pubDate ?? a.isoDate ?? "").getTime();
        const bTime = new Date(b.pubDate ?? b.isoDate ?? "").getTime();
        return bTime - aTime;
      })
      .slice(0, MAX_POSTS)
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
          thumbnail: resolveThumbnail(item, item.__channelThumbnail),
          source: item.__source,
        };
      });

    const hasFailure = settled.some((result) => result.status === "rejected");

    return {
      posts,
      error: hasFailure
        ? "일부 블로그 데이터를 불러오지 못했지만, 표시 가능한 글만 우선 노출합니다."
        : null,
    };
  } catch (err) {
    console.error("[NaverBlog] RSS 파싱 실패:", err);

    return {
      posts: [],
      error: "현재 소식을 불러올 수 없습니다. 잠시 후 다시 확인해주세요.",
    };
  }
}