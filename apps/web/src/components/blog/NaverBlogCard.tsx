"use client";

import { useEffect, useState } from "react";
import type { BlogPost } from "@/lib/blog/naverBlog";

const PLACEHOLDER_IMG = "/assets/images/dining.JPG";

interface NaverBlogCardProps {
  post: BlogPost;
}

function normalizeImageSrc(src?: string | null): string {
  if (!src) return PLACEHOLDER_IMG;

  const trimmed = src.trim();
  if (!trimmed) return PLACEHOLDER_IMG;

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
    return trimmed;
  }

  return PLACEHOLDER_IMG;
}

function getDisplayCategory(category?: string | null): string {
  if (!category) return "요양원 소식";
  if (category === "좋은요양원이란") return "요양원 선택 기준";
  if (category === "행복한요양원 소개") return "시설 소개";
  if (category === "노인관련 정보") return "장기요양 정보";
  return category;
}

export default function NaverBlogCard({ post }: NaverBlogCardProps) {
  const [imgSrc, setImgSrc] = useState(normalizeImageSrc(post.thumbnail));

  useEffect(() => {
    setImgSrc(normalizeImageSrc(post.thumbnail));
  }, [post.thumbnail]);

  const categoryLabel = getDisplayCategory(post.category);

  return (
    <a
      href={post.link}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={`${post.title} - 새 탭에서 열기`}
      className="
        group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-100
        bg-white shadow-sm transition-all duration-300 ease-in-out
        hover:-translate-y-1 hover:shadow-md
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
      "
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-stone-100">
        <img
          src={imgSrc}
          alt={post.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => {
            if (imgSrc !== PLACEHOLDER_IMG) {
              setImgSrc(PLACEHOLDER_IMG);
            }
          }}
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-700">
            {categoryLabel}
          </span>

          {post.source && (
            <span className="text-[11px] font-medium text-stone-400">
              {post.source}
            </span>
          )}
        </div>

        <div className="space-y-2">
          {post.formattedDate && (
            <time
              dateTime={post.pubDate}
              className="block text-xs font-medium tracking-wide text-stone-400"
            >
              {post.formattedDate}
            </time>
          )}

          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-stone-800 transition-colors group-hover:text-amber-700">
            {post.title}
          </h3>

          <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-stone-500">
            {post.summary || "내용을 불러오는 중입니다."}
          </p>
        </div>

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {post.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] text-stone-500"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium text-amber-600 transition-colors group-hover:text-amber-700">
          자세히 보기
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
        </span>
      </div>
    </a>
  );
}