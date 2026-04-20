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
      className="bg-amber-50/40 py-16 md:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <span
            className="
              mb-3 inline-block rounded-full
              bg-amber-100 px-4 py-1 text-xs font-semibold
              uppercase tracking-widest text-amber-700
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

          <p className="mt-3 text-base text-stone-500 md:text-lg">
            블로그에 올라온 최신 소식을 확인해보세요
          </p>

          <div className="mx-auto mt-5 h-0.5 w-12 rounded-full bg-amber-300" />
        </div>

        {error && (
          <div
            role="alert"
            className="
              mx-auto max-w-lg rounded-2xl border border-stone-200
              bg-white px-6 py-10 text-center text-stone-500
            "
          >
            <NoticeIcon className="mx-auto mb-3 h-8 w-8 text-stone-300" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!error && posts.length === 0 && (
          <div
            className="
              mx-auto max-w-lg rounded-2xl border border-stone-200
              bg-white px-6 py-10 text-center text-stone-400
            "
          >
            <NoticeIcon className="mx-auto mb-3 h-8 w-8 text-stone-300" />
            <p className="text-sm">등록된 소식이 없습니다.</p>
          </div>
        )}

        {!error && posts.length > 0 && (
          <NaverBlogFilterClient
            posts={posts}
            categories={categories}
            blogUrl={`https://blog.naver.com/${blogId}`}
          />
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