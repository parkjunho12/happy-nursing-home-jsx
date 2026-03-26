// app/blog/page.tsx
import { Suspense } from "react";
import NaverBlogSection from "@/components/blog/NaverBlogSection";

export default function BlogPage() {
  return (
    <main>
      <Suspense fallback={<NaverBlogSectionSkeleton />}>
        <NaverBlogSection />
      </Suspense>
    </main>
  );
}

function NaverBlogSectionSkeleton() {
  return (
    <section className="py-16 md:py-24 bg-amber-50/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 space-y-3">
          <div className="mx-auto h-5 w-16 rounded-full bg-stone-200 animate-pulse" />
          <div className="mx-auto h-9 w-48 rounded-lg bg-stone-200 animate-pulse" />
          <div className="mx-auto h-4 w-64 rounded bg-stone-200 animate-pulse" />
        </div>

        <ul className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li
              key={i}
              className="rounded-2xl overflow-hidden border border-stone-100 bg-white shadow-sm"
            >
              <div className="aspect-[16/9] bg-stone-200 animate-pulse" />
              <div className="p-5 space-y-2">
                <div className="h-3 w-24 rounded bg-stone-200 animate-pulse" />
                <div className="h-4 w-full rounded bg-stone-200 animate-pulse" />
                <div className="h-4 w-3/4 rounded bg-stone-200 animate-pulse" />
                <div className="h-3 w-full rounded bg-stone-100 animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-stone-100 animate-pulse" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}