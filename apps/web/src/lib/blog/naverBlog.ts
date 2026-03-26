// lib/naverBlog.ts
// 네이버 블로그 RSS를 가져오고 파싱하는 핵심 유틸 모듈

import Parser from "rss-parser";

// ─────────────────────────────────────────────
// 1. 상수 / 환경변수
// ─────────────────────────────────────────────

/** 네이버 블로그 RSS URL
 *  형식: https://rss.blog.naver.com/{블로그_아이디}
 *  환경변수가 없으면 빈 문자열 → 에러 처리에서 잡힘
 */
export const NAVER_BLOG_RSS_URL =
  process.env.NAVER_BLOG_RSS_URL ??
  "https://rss.blog.naver.com/your_blog_id"; // ← 실제 블로그 ID로 교체

/** 메인 페이지에 노출할 최대 글 수 */
export const MAX_POSTS = 6;

// ─────────────────────────────────────────────
// 2. 타입 정의
// ─────────────────────────────────────────────

export interface BlogPost {
  title: string;
  link: string;
  pubDate: string;      // ISO 날짜 문자열
  formattedDate: string; // 한국식 포맷 "2024년 3월 15일"
  summary: string;      // HTML 제거 + 2줄 요약
  thumbnail: string | null; // 썸네일 URL (없으면 null)
}

// rss-parser 커스텀 필드 타입
type CustomItem = {
  "media:content"?: { $?: { url?: string } };
  "media:thumbnail"?: { $?: { url?: string } };
  enclosure?: { url?: string };
  content?: string;
  contentSnippet?: string;
};

// ─────────────────────────────────────────────
// 3. 유틸 함수
// ─────────────────────────────────────────────

/**
 * HTML 태그 및 특수문자 엔티티 제거
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")        // 태그 제거
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")            // 연속 공백 정리
    .trim();
}

/**
 * 텍스트를 최대 n자로 자르고 말줄임표 추가
 * - 카드 2줄(약 80~100자) 기준으로 기본값 90 사용
 */
export function truncateText(text: string, maxLength = 90): string {
  const clean = stripHtml(text);
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength).trimEnd() + "…";
}

/**
 * ISO 날짜 문자열을 한국식으로 포맷
 * 예: "2024년 3월 15일"
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
 * HTML content 문자열에서 첫 번째 <img> src 추출
 */
export function extractFirstImage(html: string): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

// ─────────────────────────────────────────────
// 4. RSS 파싱 & 데이터 변환
// ─────────────────────────────────────────────

const parser = new Parser<Record<string, unknown>, CustomItem>({
  customFields: {
    item: [
      ["media:content", "media:content"],
      ["media:thumbnail", "media:thumbnail"],
      "enclosure",
      "content",
    ],
  },
});

/**
 * RSS에서 썸네일 URL 추출 (우선순위 순)
 * 1. media:thumbnail
 * 2. media:content
 * 3. enclosure
 * 4. content 안 첫 번째 img
 * 5. null
 */
function resolveThumbnail(item: CustomItem): string | null {
  return (
    item["media:thumbnail"]?.$?.url ??
    item["media:content"]?.$?.url ??
    item.enclosure?.url ??
    (item.content ? extractFirstImage(item.content) : null) ??
    null
  );
}

/**
 * 네이버 블로그 RSS를 가져와 BlogPost 배열 반환
 * - Next.js fetch 캐싱: revalidate 1시간
 * - 실패 시 빈 배열 반환 (섹션 깨짐 방지)
 */
export async function getNaverBlogPosts(): Promise<{
  posts: BlogPost[];
  error: string | null;
}> {
  // RSS URL이 미설정된 경우
  if (!NAVER_BLOG_RSS_URL || NAVER_BLOG_RSS_URL.includes("your_blog_id")) {
    return {
      posts: [],
      error: "RSS URL이 설정되지 않았습니다. 환경변수를 확인하세요.",
    };
  }

  try {
    // Next.js fetch를 이용해 캐싱 (rss-parser 내부도 fetch 사용)
    // rss-parser는 node-fetch를 쓰므로, 별도로 fetch 후 text 전달 방식 사용
    const res = await fetch(NAVER_BLOG_RSS_URL, {
      next: { revalidate: 3600 }, // 1시간 캐싱
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; NaverBlogRSSReader/1.0)",
      },
    });

    if (!res.ok) {
      throw new Error(`RSS 응답 오류: ${res.status} ${res.statusText}`);
    }

    const xml = await res.text();
    const feed = await parser.parseString(xml);

    const posts: BlogPost[] = feed.items
      .slice(0, MAX_POSTS)
      .map((item) => {
        const thumbnail = resolveThumbnail(item as CustomItem);
        const rawDescription = item.contentSnippet ?? item.content ?? item.summary ?? "";
        const summary = truncateText(rawDescription, 90);
        const pubDate = item.pubDate ?? item.isoDate ?? "";
        const formattedDate = formatDateKo(pubDate);

        return {
          title: stripHtml(item.title ?? "제목 없음"),
          link: item.link ?? "#",
          pubDate,
          formattedDate,
          summary,
          thumbnail,
        };
      });

    return { posts, error: null };
  } catch (err) {
    console.error("[NaverBlog] RSS 파싱 실패:", err);
    return {
      posts: [],
      error: "현재 소식을 불러올 수 없습니다. 잠시 후 다시 확인해주세요.",
    };
  }
}