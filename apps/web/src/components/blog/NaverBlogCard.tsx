"use client";

import { useState } from "react";
import Image from "next/image";
import type { BlogPost } from "@/lib/blog/naverBlog";

const PLACEHOLDER_IMG = "/assets/images/dining.JPG";

interface NaverBlogCardProps {
  post: BlogPost;
}

export default function NaverBlogCard({ post }: NaverBlogCardProps) {
  const initialSrc =
    post.thumbnail && post.thumbnail.trim() !== ""
      ? post.thumbnail
      : PLACEHOLDER_IMG;

  const [imgSrc, setImgSrc] = useState(initialSrc);

  return (
    <a
      href={post.link}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={`${post.title} - 새 탭에서 열기`}
      className="
        group flex flex-col bg-white rounded-2xl overflow-hidden
        shadow-sm hover:shadow-md
        border border-stone-100
        transition-all duration-300 ease-in-out
        hover:-translate-y-1
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
      "
    >
      <div className="relative w-full aspect-[16/9] overflow-hidden bg-stone-100">
        <Image
          src={imgSrc}
          alt={post.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          unoptimized
          onError={() => setImgSrc(PLACEHOLDER_IMG)}
        />
      </div>

      <div className="flex flex-col flex-1 p-5 gap-2">
        {post.formattedDate && (
          <time
            dateTime={post.pubDate}
            className="text-xs text-stone-400 font-medium tracking-wide"
          >
            {post.formattedDate}
          </time>
        )}

        <h3 className="text-[15px] font-semibold text-stone-800 leading-snug line-clamp-2 group-hover:text-amber-700 transition-colors">
          {post.title}
        </h3>

        <p className="text-sm text-stone-500 leading-relaxed line-clamp-2 flex-1">
          {post.summary || "내용을 불러오는 중입니다."}
        </p>

        <span className="inline-flex items-center gap-1 mt-1 text-sm font-medium text-amber-600 group-hover:text-amber-700 transition-colors">
          자세히 보기
        </span>
      </div>
    </a>
  );
}