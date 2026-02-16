import type { DocumentChunk, SearchResult } from '@/types/chat'

/**
 * BM25 검색 엔진
 * TF-IDF의 개선 버전으로 문서 길이 정규화 포함
 */

// BM25 파라미터
const K1 = 1.5  // term frequency saturation
const B = 0.75  // length normalization

/**
 * IDF (Inverse Document Frequency) 계산
 */
function calculateIDF(term: string, allChunks: DocumentChunk[]): number {
  const docsWithTerm = allChunks.filter(chunk => 
    chunk.tokens.includes(term)
  ).length
  
  if (docsWithTerm === 0) return 0
  
  // IDF = log((N - df + 0.5) / (df + 0.5) + 1)
  const N = allChunks.length
  const idf = Math.log((N - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1)
  
  return idf
}

/**
 * TF (Term Frequency) 계산
 */
function calculateTF(term: string, chunk: DocumentChunk): number {
  const count = chunk.tokens.filter(t => t === term).length
  return count
}

/**
 * BM25 점수 계산
 */
function calculateBM25(
  query: string[],
  chunk: DocumentChunk,
  allChunks: DocumentChunk[],
  avgDocLength: number
): number {
  let score = 0
  const docLength = chunk.tokens.length
  
  query.forEach(term => {
    const tf = calculateTF(term, chunk)
    const idf = calculateIDF(term, allChunks)
    
    // BM25 formula
    const numerator = tf * (K1 + 1)
    const denominator = tf + K1 * (1 - B + B * (docLength / avgDocLength))
    
    score += idf * (numerator / denominator)
  })
  
  return score
}

/**
 * 평균 문서 길이 계산
 */
function getAverageDocLength(chunks: DocumentChunk[]): number {
  if (chunks.length === 0) return 0
  
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.tokens.length, 0)
  return totalLength / chunks.length
}

/**
 * 쿼리 토큰화 (mdLoader의 tokenize와 동일 로직)
 */
function tokenizeQuery(query: string): string[] {
  const stopwords = new Set([
    '은', '는', '이', '가', '을', '를', '의', '에', '에서', '으로', '로',
    '과', '와', '도', '만', '까지', '부터', '하고', '그리고', '또는',
    '그', '이', '그것', '저', '저것', '이것', '저것들', '그것들',
    '등', '및', '무엇', '어떻게', '언제', '어디', '왜', '누구'
  ])
  
  const normalized = query.toLowerCase()
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  const words = normalized.split(' ').filter(w => w.length > 0)
  const tokens = new Set<string>()
  
  // 1-gram
  words.forEach(word => {
    if (!stopwords.has(word) && word.length > 1) {
      tokens.add(word)
    }
  })
  
  // 2-gram
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i] + ' ' + words[i + 1]
    if (bigram.length >= 3) {
      tokens.add(bigram)
    }
  }
  
  return Array.from(tokens)
}

/**
 * BM25 검색 (Main Function)
 */
export function searchDocuments(
  query: string,
  allChunks: DocumentChunk[],
  topK: number = 4,
  minScore: number = 0.5
): SearchResult[] {
  if (!query || allChunks.length === 0) {
    return []
  }
  
  // 1. 쿼리 토큰화
  const queryTokens = tokenizeQuery(query)
  
  if (queryTokens.length === 0) {
    return []
  }
  
  // 2. 평균 문서 길이
  const avgDocLength = getAverageDocLength(allChunks)
  
  // 3. 각 청크별 BM25 점수 계산
  const results: SearchResult[] = allChunks.map(chunk => {
    const score = calculateBM25(queryTokens, chunk, allChunks, avgDocLength)
    
    return {
      chunk,
      score
    }
  })
  
  // 4. 점수 순 정렬
  results.sort((a, b) => b.score - a.score)
  
  // 5. 최소 점수 필터링 + topK
  const filtered = results
    .filter(r => r.score >= minScore)
    .slice(0, topK)
  
  // 6. 하이라이트 생성 (선택적)
  filtered.forEach(result => {
    result.highlights = generateHighlights(result.chunk.text, queryTokens)
  })
  
  return filtered
}

/**
 * 하이라이트 생성 (검색어가 포함된 문장 추출)
 */
function generateHighlights(text: string, queryTokens: string[]): string[] {
  const sentences = text.split(/[.!?]\s+/)
  const highlights: string[] = []
  
  sentences.forEach(sentence => {
    const normalized = sentence.toLowerCase()
    
    // 쿼리 토큰이 포함된 문장
    if (queryTokens.some(token => normalized.includes(token))) {
      highlights.push(sentence.trim())
    }
  })
  
  // 최대 2개
  return highlights.slice(0, 2)
}

/**
 * 간단한 유사도 검색 (Fallback)
 * BM25 점수가 너무 낮을 때 사용
 */
export function fuzzySearch(
  query: string,
  allChunks: DocumentChunk[],
  topK: number = 4
): SearchResult[] {
  const queryLower = query.toLowerCase()
  const queryTokens = tokenizeQuery(query)
  
  const results: SearchResult[] = allChunks.map(chunk => {
    let score = 0
    
    // 완전 매칭
    if (chunk.text.toLowerCase().includes(queryLower)) {
      score += 10
    }
    
    // 제목/헤딩 매칭
    if (chunk.title.toLowerCase().includes(queryLower)) {
      score += 5
    }
    if (chunk.heading.toLowerCase().includes(queryLower)) {
      score += 5
    }
    
    // 토큰 매칭
    queryTokens.forEach(token => {
      if (chunk.tokens.includes(token)) {
        score += 1
      }
    })
    
    return { chunk, score }
  })
  
  results.sort((a, b) => b.score - a.score)
  
  return results.slice(0, topK).filter(r => r.score > 0)
}

/**
 * 검색 결과 요약 (디버깅용)
 */
export function summarizeSearchResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No results found'
  }
  
  return results.map((r, i) => 
    `${i + 1}. ${r.chunk.title} - ${r.chunk.heading} (score: ${r.score.toFixed(2)})`
  ).join('\n')
}