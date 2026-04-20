"use client";

import { useMemo, useState } from "react";
import type { BlogPost } from "@/lib/blog/naverBlog";
import NaverBlogCard from "./NaverBlogCard";

type Props = {
  posts: BlogPost[];
  categories: string[];
  blogUrl: string;
};

function getDisplayCategory(category: string) {
  if (category === "좋은요양원이란") return "요양원 선택 기준";
  if (category === "행복한요양원 소개") return "시설 소개";
  if (category === "노인관련 정보") return "장기요양 정보";
  return category;
}

export default function NaverBlogFilterClient({
  posts,
  categories,
  blogUrl,
}: Props) {
  const [activeCategory, setActiveCategory] = useState("전체");

  const filteredPosts = useMemo(() => {
    if (activeCategory === "전체") return posts;
    return posts.filter((post) => post.category === activeCategory);
  }, [posts, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      counts.set(post.category, (counts.get(post.category) ?? 0) + 1);
    }
    return counts;
  }, [posts]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* 왼쪽 카테고리 패널 */}
      <aside
        className="
          border-b border-stone-100 p-5
          lg:min-h-full lg:border-b-0 lg:border-r lg:border-stone-100 lg:p-8
        "
      >
        <div className="lg:sticky lg:top-24">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
              Categories
            </p>
            <h3 className="mt-2 text-lg font-semibold text-stone-800">
              카테고리
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              원하는 주제를 선택해 관련 소식만 모아보세요.
            </p>
          </div>

          <nav aria-label="블로그 카테고리">
            <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              {categories.map((category) => {
                const isActive = activeCategory === category;
                const count =
                  category === "전체"
                    ? posts.length
                    : (categoryCounts.get(category) ?? 0);

                return (
                  <li key={category} className="shrink-0 lg:w-full">
                    <button
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      aria-pressed={isActive}
                      className={[
                        "flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-amber-500 text-white shadow-sm"
                          : "bg-stone-50 text-stone-700 hover:bg-amber-50 hover:text-amber-700",
                      ].join(" ")}
                    >
                      <span className="whitespace-nowrap">
                        {getDisplayCategory(category)}
                      </span>

                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs",
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-white text-stone-500",
                        ].join(" ")}
                      >
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>

      {/* 오른쪽 콘텐츠 영역 */}
      <div className="p-5 md:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-3 border-b border-stone-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-amber-700">
              {getDisplayCategory(activeCategory)}
            </p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-stone-800">
              {activeCategory === "전체"
                ? "최신 블로그 소식"
                : `${getDisplayCategory(activeCategory)} 글 모아보기`}
            </h3>
            <p className="mt-2 text-sm text-stone-500">
              총 {filteredPosts.length}개의 글이 있습니다.
            </p>
          </div>

          <a
            href={blogUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="
              inline-flex items-center gap-2 self-start rounded-full border border-amber-300
              bg-white px-5 py-2.5 text-sm font-medium text-amber-700
              shadow-sm transition-all duration-200 hover:bg-amber-50 hover:shadow-md
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
            "
          >
            블로그 전체 보기
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
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

        {filteredPosts.length === 0 ? (
          <div className="rounded-3xl border border-stone-200 bg-stone-50 px-6 py-12 text-center text-stone-400">
            <p className="text-sm md:text-base">
              해당 카테고리의 소식이 없습니다.
            </p>
          </div>
        ) : (
          <ul
            role="list"
            className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
          >
            {filteredPosts.map((post) => (
              <li key={post.link}>
                <NaverBlogCard post={post} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}