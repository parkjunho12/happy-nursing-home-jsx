import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import MobileCTA from '@/components/layout/MobileCTA'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-screen">{children}</main>
      <Footer />
      <MobileCTA />
    </>
  )
}
