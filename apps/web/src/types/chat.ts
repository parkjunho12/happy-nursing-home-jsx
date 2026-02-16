/**
 * RAG 챗봇 타입 정의
 */

// Markdown Frontmatter
export interface Frontmatter {
    title: string
    route: string
    updated: string
    category: string
  }
  
  // Document Chunk (검색 단위)
  export interface DocumentChunk {
    id: string                // 고유 ID (파일명-섹션번호)
    title: string             // 문서 제목
    route: string             // 페이지 경로
    category: string          // 카테고리
    heading: string           // 섹션 제목 (h2)
    text: string              // 본문 (800-1200자)
    position: number          // 문서 내 위치
    tokens: string[]          // 토큰화된 텍스트
  }
  
  // 검색 결과
  export interface SearchResult {
    chunk: DocumentChunk
    score: number             // 관련도 점수
    highlights?: string[]     // 하이라이트 텍스트
  }
  
  // 챗 메시지
  export interface ChatMessage {
    role: 'user' | 'assistant' | 'system'
    content: string
    sources?: CitationSource[]  // 출처 (assistant만)
  }
  
  // 출처 (Citation)
  export interface CitationSource {
    title: string              // 문서 제목
    route: string              // 페이지 경로
    heading: string            // 섹션 제목
    chunkId: string            // Chunk ID
  }
  
  // 챗 요청/응답
  export interface ChatRequest {
    message: string
    history?: ChatMessage[]
  }
  
  export interface ChatResponse {
    message: string
    sources: CitationSource[]
    hasRelevantSources: boolean
  }