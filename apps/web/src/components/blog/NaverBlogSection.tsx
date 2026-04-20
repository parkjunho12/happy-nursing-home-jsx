// components/home/NaverBlogSection.tsx
import { getNaverBlogPosts } from "@/lib/blog/naverBlog";
import NaverBlogFilterClient from "./NaverBlogFilterClient";

export default async function NaverBlogSection() {
  const { posts, categories, error } = await getNaverBlogPosts();
  const blogId = process.env.NAVER_BLOG_ID_1 ?? "your_blog_id";

  return (
    <section
      id="news"
      aria-labelledby="news-heading"
      className="bg-gradient-to-b from-amber-50/60 to-white py-16 md:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 상단 헤더 */}
        <div className="mb-12 md:mb-14">
          <div className="max-w-3xl">
            <span
              className="
                mb-4 inline-flex items-center rounded-full
                bg-amber-100 px-4 py-1 text-xs font-semibold
                uppercase tracking-[0.2em] text-amber-700
              "
            >
              Blog
            </span>

            <h2
              id="news-heading"
              className="text-3xl font-bold tracking-tight text-stone-800 md:text-4xl"
            >
              요양원 소식
            </h2>

            <p className="mt-4 text-base leading-relaxed text-stone-500 md:text-lg">
              시설 소개, 장기요양 정보, 요양원 선택에 도움이 되는 글을
              카테고리별로 편하게 살펴보세요.
            </p>

            <div className="mt-6 h-0.5 w-14 rounded-full bg-amber-300" />
          </div>
        </div>

        {/* 에러 상태 */}
        {error && (
          <div
            role="alert"
            className="
              mx-auto max-w-xl rounded-3xl border border-stone-200
              bg-white px-6 py-12 text-center text-stone-500 shadow-sm
            "
          >
            <NoticeIcon className="mx-auto mb-4 h-8 w-8 text-stone-300" />
            <p className="text-sm md:text-base">{error}</p>
          </div>
        )}

        {/* 빈 상태 */}
        {!error && posts.length === 0 && (
          <div
            className="
              mx-auto max-w-xl rounded-3xl border border-stone-200
              bg-white px-6 py-12 text-center text-stone-400 shadow-sm
            "
          >
            <NoticeIcon className="mx-auto mb-4 h-8 w-8 text-stone-300" />
            <p className="text-sm md:text-base">등록된 소식이 없습니다.</p>
          </div>
        )}

        {/* 콘텐츠 */}
        {!error && posts.length > 0 && (
          <div
            className="
              rounded-[2rem] border border-amber-100/80 bg-white/90
              shadow-[0_10px_40px_rgba(120,90,40,0.06)]
              backdrop-blur-sm
            "
          >
            <NaverBlogFilterClient
              posts={posts}
              categories={categories}
              blogUrl={`https://blog.naver.com/${blogId}`}
            />
          </div>
        )}
      </div>
    </section>
  );
}

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