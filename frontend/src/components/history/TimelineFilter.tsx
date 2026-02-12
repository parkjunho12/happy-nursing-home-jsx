'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Calendar } from 'lucide-react'

interface TimelineFilterProps {
  years: number[]
  selectedYear: number | null
  selectedMonth: number | null
  onYearChange: (year: number | null) => void
  onMonthChange: (month: number | null) => void
}

const MONTHS = [
  { value: 1, label: '1월' },
  { value: 2, label: '2월' },
  { value: 3, label: '3월' },
  { value: 4, label: '4월' },
  { value: 5, label: '5월' },
  { value: 6, label: '6월' },
  { value: 7, label: '7월' },
  { value: 8, label: '8월' },
  { value: 9, label: '9월' },
  { value: 10, label: '10월' },
  { value: 11, label: '11월' },
  { value: 12, label: '12월' },
]

export default function TimelineFilter({
  years,
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
}: TimelineFilterProps) {
  return (
    <div className="space-y-4">
      {/* Year Filter */}
      <div>
        <h3 className="text-sm font-semibold text-primary-brown mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          연도
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              onYearChange(null)
              onMonthChange(null)
            }}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all',
              selectedYear === null
                ? 'bg-primary-orange text-white'
                : 'bg-white border border-border-light text-primary-brown hover:border-primary-orange'
            )}
          >
            전체
          </button>
          {years.map((year) => (
            <button
              key={year}
              onClick={() => {
                onYearChange(year)
                if (selectedYear !== year) {
                  onMonthChange(null)
                }
              }}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                selectedYear === year
                  ? 'bg-primary-orange text-white'
                  : 'bg-white border border-border-light text-primary-brown hover:border-primary-orange'
              )}
            >
              {year}년
            </button>
          ))}
        </div>
      </div>

      {/* Month Filter */}
      {selectedYear && (
        <div>
          <h3 className="text-sm font-semibold text-primary-brown mb-3">월</h3>
          <div className="grid grid-cols-4 gap-2">
            {MONTHS.map((month) => (
              <button
                key={month.value}
                onClick={() => onMonthChange(month.value === selectedMonth ? null : month.value)}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  selectedMonth === month.value
                    ? 'bg-primary-green text-white'
                    : 'bg-white border border-border-light text-primary-brown hover:border-primary-green'
                )}
              >
                {month.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}