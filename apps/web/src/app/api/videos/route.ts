import { NextResponse } from 'next/server'

/** 유튜브 채널 RSS → JSON (서버에서 1시간 캐시, 클라이언트 CORS 우회) */
export const revalidate = 3600

const CHANNEL_ID = 'UCr5NVnuu8ROSXjAuY1uVM-Q'
const RSS = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`

const unescape = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")

export async function GET() {
  try {
    const res = await fetch(RSS, { next: { revalidate: 3600 } })
    if (!res.ok) return NextResponse.json({ videos: [] })
    const xml = await res.text()
    const videos = []
    for (const entry of xml.split('<entry>').slice(1)) {
      const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
      const title = entry.match(/<title>([^<]*)<\/title>/)?.[1]
      const published = entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? null
      if (id && title) videos.push({ id, title: unescape(title), published })
    }
    return NextResponse.json({ videos })
  } catch {
    return NextResponse.json({ videos: [] })
  }
}
