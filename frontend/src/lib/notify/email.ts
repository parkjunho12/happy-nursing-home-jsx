import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
}) {
  const from = process.env.MAIL_FROM
  if (!from) throw new Error('MAIL_FROM is not set')
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set')

  const { to, subject, html } = params

  const result = await resend.emails.send({
    from: '행복한요양원 <onboarding@resend.dev>',
    to,
    subject,
    html,
  })
  console.log('Email sent:', result)

  return result
}

export function renderContactReceivedEmail(opts: {
  name: string
  inquiryType: string
  message: string
  ticketId: string
}) {
  const { name, inquiryType, message, ticketId } = opts

  return `
    <div style="font-family: Arial, sans-serif; line-height:1.6">
      <h2>상담 신청이 접수되었습니다</h2>
      <p>${name}님, 안녕하세요. 행복한요양원입니다.</p>
      <p>문의가 정상 접수되었습니다. <b>24시간 이내</b> 답변드리겠습니다.</p>
      <hr />
      <p><b>접수번호:</b> ${ticketId}</p>
      <p><b>문의유형:</b> ${inquiryType}</p>
      <p><b>문의내용:</b><br/>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
      <hr />
      <p style="color:#666; font-size:12px">
        본 메일은 발신 전용입니다.
      </p>
    </div>
  `
}

export function renderContactRepliedEmail(opts: {
  name: string
  inquiryType: string
  message: string
  reply: string
  ticketId: string
  repliedBy?: string | null
}) {
  const { name, inquiryType, message, reply, ticketId, repliedBy } = opts

  return `
    <div style="font-family: Arial, sans-serif; line-height:1.6">
      <h2>상담 답변 안내</h2>
      <p>${name}님, 안녕하세요. 행복한요양원입니다.</p>
      <p>문의하신 내용에 대해 답변드립니다.</p>
      <hr />
      <p><b>접수번호:</b> ${ticketId}</p>
      <p><b>문의유형:</b> ${inquiryType}</p>
      <p><b>문의내용:</b><br/>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
      <hr />
      <p><b>답변:</b><br/>${escapeHtml(reply).replace(/\n/g, '<br/>')}</p>
      ${repliedBy ? `<p style="margin-top:12px; color:#666;">담당자: ${escapeHtml(repliedBy)}</p>` : ``}
      <hr />
      <p style="color:#666; font-size:12px">
        본 메일은 발신 전용입니다.
      </p>
    </div>
  `
}

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
