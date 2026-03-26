// components/home/NaverBlogSection.tsx
// 메인 페이지에 삽입하는 "요양원 소식" 섹션 (서버 컴포넌트)
// - RSS 데이터를 서버에서 직접 fetch
// - 에러/빈 상태 처리 포함

import { getNaverBlogPosts } from "@/lib/blog/naverBlog";
import NaverBlogCard from "./NaverBlogCard";

export default async function NaverBlogSection() {
  // 서버에서 RSS 데이터 fetch (1시간 캐싱)
  const { posts, error } = await getNaverBlogPosts();

  return (
    <section
      id="news"
      aria-labelledby="news-heading"
      className="py-16 md:py-24 bg-amber-50/40"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── 섹션 헤더 ── */}
        <div className="text-center mb-12">
          {/* 배지 */}
          <span className="
            inline-block mb-3 px-4 py-1 rounded-full
            bg-amber-100 text-amber-700 text-xs font-semibold tracking-widest uppercase
          ">
            Blog
          </span>

          <h2
            id="news-heading"
            className="text-3xl md:text-4xl font-bold text-stone-800 tracking-tight"
          >
            요양원 소식
          </h2>

          <p className="mt-3 text-stone-500 text-base md:text-lg">
            블로그에 올라온 최신 소식을 확인해보세요
          </p>

          {/* 구분선 */}
          <div className="mx-auto mt-5 w-12 h-0.5 rounded-full bg-amber-300" />
        </div>

        {/* ── 에러 상태 ── */}
        {error && (
          <div
            role="alert"
            className="
              mx-auto max-w-lg text-center py-10 px-6
              rounded-2xl border border-stone-200 bg-white text-stone-500
            "
          >
            <NoticeIcon className="mx-auto mb-3 w-8 h-8 text-stone-300" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* ── 글 없음 상태 ── */}
        {!error && posts.length === 0 && (
          <div className="mx-auto max-w-lg text-center py-10 px-6 rounded-2xl border border-stone-200 bg-white text-stone-400">
            <NoticeIcon className="mx-auto mb-3 w-8 h-8 text-stone-300" />
            <p className="text-sm">등록된 소식이 없습니다.</p>
          </div>
        )}

        {/* ── 카드 그리드 ── */}
        {!error && posts.length > 0 && (
          <>
            <ul
              role="list"
              className="
                grid gap-6
                grid-cols-1
                sm:grid-cols-2
                lg:grid-cols-3
              "
            >
              {posts.map((post) => (
                <li key={post.link}>
                  <NaverBlogCard post={post} />
                </li>
              ))}
            </ul>

            {/* ── 더보기 링크 ── */}
            <div className="mt-12 text-center">
              <a
                href={`https://blog.naver.com/${
                  process.env.NAVER_BLOG_ID ?? "your_blog_id"
                }`}
                target="_blank"
                rel="noreferrer noopener"
                className="
                  inline-flex items-center gap-2 px-7 py-3
                  rounded-full border border-amber-300 bg-white
                  text-sm font-medium text-amber-700
                  shadow-sm hover:shadow-md hover:bg-amber-50
                  transition-all duration-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
                "
              >
                블로그에서 더 보기
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.22 14.78a.75.75 0 0 0 1.06 0l7.22-7.22v5.69a.75.75 0 0 0 1.5 0v-7.5a.75.75 0 0 0-.75-.75h-7.5a.75.75 0 0 0 0 1.5h5.69l-7.22 7.22a.75.75 0 0 0 0 1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ── 아이콘 (inline SVG, 외부 라이브러리 불필요) ──
function NoticeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
      />
    </svg>
  );
}