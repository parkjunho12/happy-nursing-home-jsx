'use client'

import React from 'react'
import { HistoryCategory, CATEGORY_CONFIG } from '@/types/history'
import { cn } from '@/lib/utils'

interface CategoryTabsProps {
  selected: HistoryCategory | null
  counts?: Record<HistoryCategory, number>
  onChange: (category: HistoryCategory | null) => void
}

export default function CategoryTabs({ selected, counts, onChange }: CategoryTabsProps) {
  const categories: (HistoryCategory | null)[] = [
    null,
    'NOTICE',
    'PROGRAM',
    'MEAL',
    'FACILITY',
    'FAMILY',
    'ARCHIVE',
  ]

  return (
    <div className="flex flex-wrap gap-3">
      {categories.map((category) => {
        const isAll = category === null
        const isSelected = category === selected
        const config = category ? CATEGORY_CONFIG[category] : null
        const count = category && counts ? counts[category] : null

        return (
          <button
            key={category || 'all'}
            onClick={() => onChange(category)}
            className={cn(
              'px-6 py-3 rounded-full font-semibold text-sm transition-all duration-300',
              'border-2',
              isSelected
                ? 'bg-primary-orange text-white border-primary-orange shadow-md scale-105'
                : 'bg-white text-primary-brown border-border-light hover:border-primary-orange hover:-translate-y-0.5'
            )}
          >
            {isAll ? (
              '전체'
            ) : (
              <>
                <span className="mr-2">{config?.emoji}</span>
                {config?.label}
                {count !== undefined && count > 0 && (
                  <span className="ml-2 opacity-70">({count})</span>
                )}
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}