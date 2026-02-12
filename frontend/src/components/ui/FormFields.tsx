import React from 'react'
import { cn } from '@/lib/utils'

// Select Component
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  options: { value: string; label: string }[]
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      className,
      id,
      required,
      ...props
    },
    ref
  ) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-semibold text-primary-brown mb-2"
          >
            {label}
            {required && <span className="text-primary-orange ml-1">*</span>}
          </label>
        )}

        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full px-4 py-3.5 border-2 rounded-xl text-base transition-all duration-200',
            'focus:outline-none focus:border-primary-orange focus:ring-4 focus:ring-primary-orange/10',
            'disabled:bg-gray-100 disabled:cursor-not-allowed',
            'appearance-none bg-white bg-no-repeat bg-[right_1rem_center]',
            'bg-[length:1.5rem]',
            error ? 'border-red-500' : 'border-border-light',
            className
          )}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23666666'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
          }}
          required={required}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {error && (
          <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
            <span>⚠️</span>
            {error}
          </p>
        )}

        {helperText && !error && (
          <p className="mt-1.5 text-sm text-text-gray">{helperText}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

// Textarea Component
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      className,
      id,
      required,
      ...props
    },
    ref
  ) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-semibold text-primary-brown mb-2"
          >
            {label}
            {required && <span className="text-primary-orange ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full px-4 py-3.5 border-2 rounded-xl text-base transition-all duration-200',
            'focus:outline-none focus:border-primary-orange focus:ring-4 focus:ring-primary-orange/10',
            'disabled:bg-gray-100 disabled:cursor-not-allowed',
            'resize-vertical min-h-[120px]',
            error ? 'border-red-500' : 'border-border-light',
            className
          )}
          required={required}
          {...props}
        />

        {error && (
          <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
            <span>⚠️</span>
            {error}
          </p>
        )}

        {helperText && !error && (
          <p className="mt-1.5 text-sm text-text-gray">{helperText}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'