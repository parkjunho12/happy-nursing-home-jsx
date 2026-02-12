'use client'

import React, { useState, useEffect } from 'react'
import { HistoryCategory, HistoryListItem } from '@/types/history'
import HistoryCard from '@/components/history/HistoryCard'
import CategoryTabs from '@/components/history/CategoryTabs'
import HistorySearch from '@/components/history/HistorySearch'
import TimelineFilter from '@/components/history/TimelineFilter'
import { BookOpen, Clock } from 'lucide-react'

export default function HistoryPage() {
  const [posts, setPosts] = useState<HistoryListItem[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState<HistoryCategory | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Meta data
  const [years, setYears] = useState<number[]>([])
  const [categoryCounts, setCategoryCounts] = useState<Record<HistoryCategory, number>>()

  // Fetch meta data
  useEffect(() => {
    async function fetchMeta() {
      try {
        const res = await fetch('/api/history?meta=true')
        const data = await res.json()
        if (data.success) {
          setYears(data.data.years)
          setCategoryCounts(data.data.categoryCounts)
        }
      } catch (error) {
        console.error('Failed to fetch meta:', error)
      }
    }
    fetchMeta()
  }, [])

  // Fetch posts
  useEffect(() => {
    async function fetchPosts() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (selectedCategory) params.append('category', selectedCategory)
        if (selectedYear) params.append('year', selectedYear.toString())
        if (selectedMonth) params.append('month', selectedMonth.toString())
        if (searchQuery) params.append('search', searchQuery)

        const res = await fetch(`/api/history?${params}`)
        const data = await res.json()
        
        if (data.success) {
          setPosts(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch posts:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [selectedCategory, selectedYear, selectedMonth, searchQuery])

  return (
    <div className="min-h-screen bg-bg-cream pt-20">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-white to-bg-cream py-16 border-b border-border-light">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-orange/10 text-primary-orange rounded-full text-sm font-semibold mb-6">
              <BookOpen className="w-4 h-4" />
              History Archive
            </div>
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-primary-brown mb-4">
              기록이 쌓여 <span className="text-primary-orange">운영이 보이는</span> 요양원
            </h1>
            <p className="text-lg text-text-gray leading-relaxed">
              매일의 정성과 노력을 기록합니다.
              <br />
              투명한 운영, 따뜻한 소통이 담긴 우리의 이야기입니다.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-[300px,1fr] gap-8">
          {/* Sidebar - Filters */}
          <aside className="space-y-6">
            {/* Search */}
            <div>
              <HistorySearch value={searchQuery} onChange={setSearchQuery} />
            </div>

            {/* Timeline Filter */}
            <div className="bg-white rounded-3xl p-6 border-2 border-border-light">
              <TimelineFilter
                years={years}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                onYearChange={setSelectedYear}
                onMonthChange={setSelectedMonth}
              />
            </div>

            {/* Info Card */}
            <div className="bg-gradient-to-br from-primary-orange to-accent-lightOrange text-white rounded-3xl p-6">
              <Clock className="w-10 h-10 mb-3" />
              <h3 className="font-bold text-lg mb-2">매일 업데이트</h3>
              <p className="text-sm opacity-90 leading-relaxed">
                행복한요양원의 일상과 소식을 실시간으로 확인하세요.
              </p>
            </div>
          </aside>

          {/* Main Content */}
          <div className="space-y-8">
            {/* Category Tabs */}
            <div>
              <CategoryTabs
                selected={selectedCategory}
                counts={categoryCounts}
                onChange={setSelectedCategory}
              />
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-between">
              <p className="text-text-gray">
                총 <span className="font-bold text-primary-brown">{posts.length}</span>개의 기록
              </p>
            </div>

            {/* Posts Grid */}
            {loading ? (
              <div className="grid md:grid-cols-2 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-white border-2 border-border-light rounded-3xl overflow-hidden animate-pulse"
                  >
                    <div className="aspect-video bg-gray-200" />
                    <div className="p-6 space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                      <div className="h-20 bg-gray-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">📭</div>
                <h3 className="text-xl font-bold text-primary-brown mb-2">
                  검색 결과가 없습니다
                </h3>
                <p className="text-text-gray">
                  다른 카테고리나 기간을 선택해보세요
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {posts.map((post) => (
                  <HistoryCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}