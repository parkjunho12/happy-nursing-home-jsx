import fs from 'fs'
import path from 'path'
import type { Frontmatter, DocumentChunk } from '@/types/chat'

/**
 * Frontmatter 파싱
 */
function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
  const match = content.match(frontmatterRegex)
  
  if (!match) {
    throw new Error('Invalid frontmatter format')
  }
  
  const [, frontmatterStr, body] = match
  const frontmatter: any = {}
  
  frontmatterStr.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':')
    if (key && valueParts.length > 0) {
      frontmatter[key.trim()] = valueParts.join(':').trim().replace(/^["']|["']$/g, '')
    }
  })
  
  return {
    frontmatter: frontmatter as Frontmatter,
    body: body.trim()
  }
}

/**
 * MD를 섹션별로 분할 (h2 기준)
 */
function splitIntoSections(markdown: string): Array<{ heading: string; text: string }> {
  const sections: Array<{ heading: string; text: string }> = []
  
  // h2 헤딩으로 분할
  const h2Regex = /^## (.+)$/gm
  const matches = [...markdown.matchAll(h2Regex)]
  
  if (matches.length === 0) {
    // h2가 없으면 전체를 하나의 섹션으로
    return [{ heading: '소개', text: markdown }]
  }
  
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i]
    const heading = currentMatch[1].trim()
    const startIndex = currentMatch.index! + currentMatch[0].length
    const endIndex = i < matches.length - 1 ? matches[i + 1].index! : markdown.length
    
    const text = markdown.slice(startIndex, endIndex).trim()
    
    if (text.length > 0) {
      sections.push({ heading, text })
    }
  }
  
  return sections
}

/**
 * 긴 섹션을 작은 청크로 분할 (800-1200자)
 */
function chunkSection(section: { heading: string; text: string }): string[] {
  const maxChunkSize = 1200
  const minChunkSize = 800
  const chunks: string[] = []
  
  // 단락으로 분할
  const paragraphs = section.text.split(/\n\n+/)
  
  let currentChunk = ''
  
  for (const para of paragraphs) {
    if (currentChunk.length + para.length < maxChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + para
    } else {
      if (currentChunk.length >= minChunkSize) {
        chunks.push(currentChunk)
        currentChunk = para
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para
        chunks.push(currentChunk)
        currentChunk = ''
      }
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk)
  }
  
  return chunks.length > 0 ? chunks : [section.text]
}

/**
 * 한국어 토큰화 (간단 버전)
 * - 공백/기호로 분리
 * - 2-gram, 3-gram 생성
 * - 불용어 제거
 */
function tokenize(text: string): string[] {
  // 불용어 (조사, 접속사 등)
  const stopwords = new Set([
    '은', '는', '이', '가', '을', '를', '의', '에', '에서', '으로', '로',
    '과', '와', '도', '만', '까지', '부터', '하고', '그리고', '또는',
    '그', '이', '그것', '저', '저것', '이것', '저것들', '그것들',
    '등', '및'
  ])
  
  // 소문자 변환 및 정규화
  const normalized = text.toLowerCase()
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ') // 특수문자 제거
    .replace(/\s+/g, ' ')
    .trim()
  
  // 공백 기준 토큰화
  const words = normalized.split(' ').filter(w => w.length > 0)
  
  const tokens = new Set<string>()
  
  // 1-gram (불용어 제거)
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
  
  // 3-gram (선택적)
  for (let i = 0; i < words.length - 2; i++) {
    const trigram = words[i] + ' ' + words[i + 1] + ' ' + words[i + 2]
    if (trigram.length >= 5) {
      tokens.add(trigram)
    }
  }
  
  return Array.from(tokens)
}

/**
 * MD 파일 로드 및 청킹
 */
export function loadMarkdownFile(filePath: string): DocumentChunk[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const { frontmatter, body } = parseFrontmatter(content)
  
  const sections = splitIntoSections(body)
  const chunks: DocumentChunk[] = []
  
  sections.forEach((section, sectionIndex) => {
    const sectionChunks = chunkSection(section)
    
    sectionChunks.forEach((chunkText, chunkIndex) => {
      const fileName = path.basename(filePath, '.md')
      const chunkId = `${fileName}-s${sectionIndex}-c${chunkIndex}`
      
      chunks.push({
        id: chunkId,
        title: frontmatter.title,
        route: frontmatter.route,
        category: frontmatter.category,
        heading: section.heading,
        text: chunkText,
        position: sectionIndex * 1000 + chunkIndex,
        tokens: tokenize(section.heading + ' ' + chunkText)
      })
    })
  })
  
  return chunks
}

/**
 * 모든 MD 파일 로드
 */
export function loadAllMarkdownFiles(contentDir: string): DocumentChunk[] {
  const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md'))
  
  const allChunks: DocumentChunk[] = []
  
  files.forEach(file => {
    const filePath = path.join(contentDir, file)
    try {
      const chunks = loadMarkdownFile(filePath)
      allChunks.push(...chunks)
    } catch (error) {
      console.error(`Error loading ${file}:`, error)
    }
  })
  
  return allChunks
}

/**
 * 빌드 타임 또는 서버 시작 시 인덱스 생성
 */
let cachedChunks: DocumentChunk[] | null = null

export function getDocumentChunks(): DocumentChunk[] {
  if (cachedChunks) {
    return cachedChunks
  }
  
  const contentDir = path.join(process.cwd(), 'content')
  cachedChunks = loadAllMarkdownFiles(contentDir)
  
  console.log(`[MD Loader] Loaded ${cachedChunks.length} chunks from ${contentDir}`)
  
  return cachedChunks
}

/**
 * 캐시 초기화 (개발 모드)
 */
export function clearCache() {
  cachedChunks = null
}