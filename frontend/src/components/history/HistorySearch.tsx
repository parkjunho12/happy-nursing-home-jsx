'use client'

import React, { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { debounce } from '@/lib/utils'

interface HistorySearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function HistorySearch({
  value,
  onChange,
  placeholder = '제목, 내용으로 검색...',
}: HistorySearchProps) {
  const [localValue, setLocalValue] = useState(value)

  // Debounced onChange
  useEffect(() => {
    const debouncedChange = debounce(() => {
      onChange(localValue)
    }, 300)

    debouncedChange()
  }, [localValue, onChange])

  const handleClear = () => {
    setLocalValue('')
    onChange('')
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-gray" />
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-4 border-2 border-border-light rounded-2xl text-base focus:outline-none focus:border-primary-orange focus:ring-4 focus:ring-primary-orange/10 transition-all"
        />
        {localValue && (
          <button
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-text-gray hover:text-primary-brown transition-colors"
            aria-label="Clear search"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}