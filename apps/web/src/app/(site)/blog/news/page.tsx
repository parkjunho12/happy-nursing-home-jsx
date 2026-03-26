// app/news/page.tsx
// "소식 더보기" 전용 페이지 — 나중에 확장할 때 사용
// MAX_POSTS 제한 없이 전체 글 표시 + 페이지네이션 추가 가능

import { getNaverBlogPosts } from "@/lib/blog/naverBlog";
import NaverBlogCard from "@/components/blog/NaverBlogCard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "요양원 소식 | 행복한요양원 녹양역점",
  description: "행복한요양원 녹양역점의 최신 소식을 확인하세요.",
};

// 페이지 수준 revalidate (1시간)
export const revalidate = 3600;

export default async function NewsPage() {
  const { posts, error } = await getNaverBlogPosts();

  return (
    <main className="min-h-screen bg-amber-50/30 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-stone-800">
            요양원 소식
          </h1>
          <p className="mt-2 text-stone-500">
            행복한요양원 녹양역점의 모든 소식을 확인하세요.
          </p>
        </div>

        {/* 에러 */}
        {error && (
          <p className="text-center text-stone-500 py-20">{error}</p>
        )}

        {/* 글 없음 */}
        {!error && posts.length === 0 && (
          <p className="text-center text-stone-400 py-20">
            등록된 소식이 없습니다.
          </p>
        )}

        {/* 카드 목록 */}
        {!error && posts.length > 0 && (
          <ul className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.link}>
                <NaverBlogCard post={post} />
              </li>
            ))}
          </ul>
        )}

        {/* TODO: 추후 페이지네이션 또는 무한스크롤 추가 */}
      </div>
    </main>
  );
}