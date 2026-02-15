import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { authAPI } from '@/api/client'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  setUser: (user: User | null) => void
}
const TOKEN_KEY = 'access_token'

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true })
          const response = await authAPI.login({ email, password })
          
          // 토큰 저장
          localStorage.setItem(TOKEN_KEY, response.access_token)
          
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: async () => {
        try {
          await authAPI.logout()
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          // 토큰 제거
          localStorage.removeItem(TOKEN_KEY)
          
          set({
            user: null,
            isAuthenticated: false,
          })
        }
      },

      checkAuth: async () => {
        // 토큰이 없으면 인증 해제
        const token = localStorage.getItem(TOKEN_KEY)
        if (!token) {
          set({
            user: null,
            isAuthenticated: false,
          })
          return
        }
        
        try {
          const user = await authAPI.me()
          set({
            user,
            isAuthenticated: true,
          })
        } catch (error) {
          // 토큰이 유효하지 않으면 제거
          localStorage.removeItem(TOKEN_KEY)
          set({
            user: null,
            isAuthenticated: false,
          })
        }
      },

      setUser: (user: User | null) => {
        set({
          user,
          isAuthenticated: !!user,
        })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)