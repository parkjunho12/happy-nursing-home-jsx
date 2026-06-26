import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { SITE_INFO } from '@/lib/constants'

const BASE_URL = 'https://www.행복한요양원녹양역.com'
const EFFECTIVE_DATE = '2026년 6월 26일'

export const metadata: Metadata = {
  title: '개인정보처리방침 | 행복한요양원 녹양역점',
  description:
    '양주 행복한요양원 녹양역점의 개인정보처리방침입니다. 수집 항목·목적, 보유 기간, 제3자 제공, 정보주체의 권리, 개인정보 보호책임자 안내를 확인하실 수 있습니다.',
  alternates: { canonical: `${BASE_URL}/privacy` },
  robots: { index: true, follow: true },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white pt-20">
      {/* Header */}
      <section className="bg-gradient-to-b from-[#fff5ec] to-white border-b border-orange-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 mb-5 shadow-sm">
            <ShieldCheck className="w-4 h-4" /> 개인정보 보호
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-[-0.02em]">개인정보처리방침</h1>
          <p className="mt-3 text-gray-600 leading-relaxed">
            {SITE_INFO.name}(이하 ‘시설’)은 「개인정보 보호법」 등 관계 법령을 준수하며,
            이용자의 개인정보를 소중하게 보호하기 위해 다음과 같은 처리방침을 두고 있습니다.
          </p>
          <p className="mt-2 text-sm text-gray-400">시행일자: {EFFECTIVE_DATE}</p>
        </div>
      </section>

      {/* Body */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="space-y-10 text-[15px] leading-[1.85] text-gray-700">

          <Article no="1" title="개인정보의 수집 항목 및 방법">
            <p>시설은 상담·자원봉사·채용지원 등 서비스 제공을 위해 아래와 같은 개인정보를 수집합니다. 이용자는 개인정보 수집·이용 동의를 거부할 권리가 있으나, 동의를 거부하실 경우 해당 서비스 이용이 제한될 수 있습니다.</p>
            <ul className="mt-3 space-y-2 list-disc pl-5">
              <li><b>입소·상담 문의:</b> 이름, 연락처(휴대전화), 이메일(선택), 문의 내용</li>
              <li><b>자원봉사 신청:</b> 이름, 연락처, 생년월일 또는 나이, 희망 활동·요일·시간, 봉사 경험·메모(선택)</li>
              <li><b>채용 지원:</b> 이름, 생년월일, 연락처, 이메일, 경력, 자기소개 (이력서를 이메일로 보내실 경우 해당 서류에 포함된 정보)</li>
              <li><b>자동 수집 정보:</b> 서비스 이용 과정에서 접속 로그, 쿠키·세션 정보, 기기·브라우저 정보, 광고 유입 경로 정보가 생성·수집될 수 있으며, IP는 식별이 불가능하도록 <b>해시 처리</b>하여 통계 목적으로만 이용합니다.</li>
            </ul>
            <p className="mt-3">수집 방법: 홈페이지의 온라인 폼(상담·자원봉사·채용), 이메일, 전화 상담, 서비스 이용 과정에서의 자동 생성.</p>
          </Article>

          <Article no="2" title="개인정보의 수집 및 이용 목적">
            <ul className="mt-1 space-y-2 list-disc pl-5">
              <li>입소 상담 및 안내, 문의에 대한 응대</li>
              <li>자원봉사자 모집·상담 및 활동 안내</li>
              <li>채용 전형 진행 및 합격 여부 안내</li>
              <li>서비스 품질 개선, 접속 통계 및 광고 효과 분석(개인 식별 정보 미사용)</li>
            </ul>
          </Article>

          <Article no="3" title="개인정보의 보유 및 이용 기간">
            <p>시설은 원칙적으로 수집·이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 다만 아래 기준에 따라 일정 기간 보관할 수 있습니다.</p>
            <ul className="mt-3 space-y-2 list-disc pl-5">
              <li><b>입소·상담 문의:</b> 상담 완료 후 3년 (소비자 상담·분쟁 처리 목적)</li>
              <li><b>자원봉사 신청:</b> 활동 종료 후 1년</li>
              <li><b>채용 지원:</b> 채용 전형 종료 후 6개월 이내 파기 (지원자가 향후 채용 활용에 동의한 경우 1년)</li>
              <li><b>자동 수집 정보(해시 처리된 접속기록 등):</b> 수집일로부터 1년</li>
            </ul>
            <p className="mt-3">관계 법령에서 별도의 보존 기간을 정하고 있는 경우에는 해당 법령에 따라 보관합니다.</p>
          </Article>

          <Article no="4" title="개인정보의 제3자 제공">
            <p>시설은 이용자의 개인정보를 본 방침에 명시한 범위 내에서만 처리하며, 이용자의 사전 동의 없이 외부에 제공하지 않습니다. 다만 법령에 근거하거나 수사기관의 적법한 요청이 있는 경우는 예외로 합니다.</p>
          </Article>

          <Article no="5" title="개인정보 처리의 위탁">
            <p>시설은 원활한 서비스 제공을 위해 아래와 같이 개인정보 처리 업무를 외부에 위탁할 수 있으며, 위탁 시 관계 법령에 따라 안전한 관리를 위한 사항을 계약 등을 통해 규정합니다.</p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">수탁 업무</th>
                    <th className="px-4 py-2.5 text-left font-semibold">위탁 내용</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  <tr className="border-t border-gray-100"><td className="px-4 py-2.5">이메일 발송 대행</td><td className="px-4 py-2.5">상담·신청·지원 알림 메일 발송</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-4 py-2.5">클라우드 인프라·호스팅</td><td className="px-4 py-2.5">서비스 운영을 위한 서버·저장소 제공</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-gray-500">구체적인 수탁업체 명단은 변동될 수 있으며, 요청 시 안내해 드립니다.</p>
          </Article>

          <Article no="6" title="쿠키 등 자동 수집 장치의 운영">
            <p>시설은 이용자 맞춤 서비스 제공 및 광고 유입·이용 통계 분석을 위해 쿠키 및 브라우저 저장소(세션 스토리지 등)를 사용할 수 있습니다. 이용자는 웹브라우저 설정을 통해 쿠키 저장을 거부할 수 있으며, 이 경우 일부 기능 이용에 제한이 있을 수 있습니다. 해당 분석에는 개인을 식별할 수 있는 정보를 사용하지 않습니다.</p>
          </Article>

          <Article no="7" title="정보주체의 권리와 행사 방법">
            <p>이용자는 언제든지 자신의 개인정보에 대해 다음의 권리를 행사할 수 있습니다.</p>
            <ul className="mt-3 space-y-2 list-disc pl-5">
              <li>개인정보 열람 요구</li>
              <li>오류 등이 있을 경우 정정 요구</li>
              <li>삭제 요구</li>
              <li>처리 정지 요구</li>
            </ul>
            <p className="mt-3">권리 행사는 아래 개인정보 보호책임자에게 전화 또는 이메일로 요청하실 수 있으며, 시설은 지체 없이 조치하겠습니다.</p>
          </Article>

          <Article no="8" title="개인정보의 파기 절차 및 방법">
            <p>개인정보는 보유 기간이 경과하거나 처리 목적이 달성되면 지체 없이 파기합니다. 전자적 파일은 복구할 수 없는 기술적 방법으로 삭제하며, 종이 문서는 분쇄하거나 소각하여 파기합니다.</p>
          </Article>

          <Article no="9" title="만 14세 미만 아동의 개인정보">
            <p>시설은 원칙적으로 만 14세 미만 아동의 개인정보를 수집하지 않습니다. 부득이하게 수집이 필요한 경우 법정대리인의 동의를 받습니다.</p>
          </Article>

          <Article no="10" title="개인정보의 안전성 확보 조치">
            <p>시설은 개인정보의 안전한 처리를 위해 접근 권한 관리, 접속 기록의 보관, 전송 구간 암호화(HTTPS), 개인 식별정보의 최소 수집·해시 처리 등 합리적인 보호조치를 취하고 있습니다.</p>
          </Article>

          <Article no="11" title="개인정보 보호책임자">
            <div className="mt-2 rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <p><b>개인정보 보호책임자:</b> {SITE_INFO.businessInfo.owner} (대표)</p>
              <p className="mt-1"><b>상호:</b> {SITE_INFO.name}</p>
              <p className="mt-1"><b>주소:</b> {SITE_INFO.address.full}</p>
              <p className="mt-1">
                <b>전화:</b>{' '}
                <a href={`tel:${SITE_INFO.phone}`} className="text-primary-orange font-semibold">{SITE_INFO.phone}</a>
                {'  ·  '}
                <b>이메일:</b>{' '}
                <a href={`mailto:${SITE_INFO.email}`} className="text-primary-orange font-semibold">{SITE_INFO.email}</a>
              </p>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              개인정보 침해에 대한 신고·상담이 필요한 경우 개인정보침해신고센터(privacy.kisa.or.kr, 국번없이 118),
              대검찰청 사이버수사과(국번없이 1301), 경찰청 사이버수사국(ecrm.police.go.kr, 국번없이 182) 등에 문의하실 수 있습니다.
            </p>
          </Article>

          <Article no="12" title="개인정보처리방침의 변경">
            <p>본 개인정보처리방침은 법령·정책 또는 서비스의 변경에 따라 수정될 수 있으며, 변경 시 홈페이지를 통해 공지합니다.</p>
          </Article>

          <div className="pt-6 border-t border-gray-100 text-sm text-gray-500">
            <p>본 방침은 {EFFECTIVE_DATE}부터 적용됩니다.</p>
            <p className="mt-3">
              <Link href="/contact" className="text-primary-orange font-semibold hover:underline">문의하기 →</Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

function Article({ no, title, children }: { no: string; title: string; children: React.ReactNode }) {
  return (
    <article>
      <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2.5">
        <span className="text-primary-orange">{no}.</span> {title}
      </h2>
      <div className="text-gray-700">{children}</div>
    </article>
  )
}
