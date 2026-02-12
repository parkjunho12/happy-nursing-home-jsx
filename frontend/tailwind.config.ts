import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    // (선택) src 하위에 다른 폴더가 있으면 추가
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          orange: '#FF8C42',
          brown: '#8B5A3C',
          green: '#7FB069',
        },
        accent: {
          peach: '#FFD4B8',
          lightOrange: '#FFB380',
        },
        bg: {
          cream: '#FFF8F3',
        },
        text: {
          dark: '#2C2C2C',
          gray: '#666666',
        },
        border: {
          light: '#E8DED2',
        },
      },
      fontFamily: {
        sans: ['var(--font-noto-sans)', 'sans-serif'],
        serif: ['var(--font-nanum-myeongjo)', 'serif'],
      },
      boxShadow: {
        soft: '0 4px 20px rgba(139, 90, 60, 0.08)',
        medium: '0 8px 24px rgba(139, 90, 60, 0.12)',
        large: '0 12px 32px rgba(139, 90, 60, 0.15)',
        'large-hover': '0 20px 60px rgba(139, 90, 60, 0.2)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-in-left': 'slideInLeft 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.5s ease-out',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
