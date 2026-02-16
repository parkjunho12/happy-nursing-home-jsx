# backend/app/services/email_service.py
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Literal

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

EmailProvider = Literal["resend", "sendgrid"]


# =========================
# Helpers
# =========================
def _split_emails(raw: str) -> List[str]:
    return [e.strip() for e in (raw or "").split(",") if e.strip()]


def _provider() -> EmailProvider:
    p = (settings.EMAIL_PROVIDER or "resend").lower()
    return "sendgrid" if p == "sendgrid" else "resend"


def _from_email() -> str:
    # 운영에서 필수. 개발에서만 fallback 허용
    if settings.MAIL_FROM:
        return settings.MAIL_FROM
    return "Happy Nursing Home <no-reply@example.com>"


def _reply_to() -> Optional[str]:
    return settings.MAIL_REPLY_TO or None


def _admin_recipients() -> List[str]:
    return _split_emails(settings.MAIL_ADMIN_TO)


def _public_site_url() -> str:
    return (settings.PUBLIC_SITE_URL or "").rstrip("/")


def _admin_url() -> str:
    # ADMIN_URL 없으면 PUBLIC_SITE_URL 사용
    return (settings.ADMIN_URL or settings.PUBLIC_SITE_URL or "").rstrip("/")


def _build_admin_contact_url(contact_id: Any) -> str:
    base = _admin_url()
    if not base:
        return ""
    # 너 구조상 admin SPA가 /admin 라우트 쓰는지, 서브도메인인지에 따라 달라질 수 있음.
    # 지금은 base + /admin/contacts/:id 로 통일.
    return f"{base}/admin/contacts/{contact_id}"


def _escape(s: str) -> str:
    return (
        (s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _prefix_env(subject: str) -> str:
    # 개발환경에서 제목에 [DEV] 붙여 실수 방지
    if (settings.ENVIRONMENT or "").lower() in ("dev", "development", "local"):
        return f"[DEV] {subject}"
    return subject


# =========================
# Provider Senders
# =========================
async def _send_resend(*, to: List[str], subject: str, html: str, text: Optional[str], reply_to: Optional[str]) -> Dict[str, Any]:
    api_key = settings.RESEND_API_KEY
    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not set")

    payload: Dict[str, Any] = {
        "from": _from_email(),
        "to": to,
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text
    if reply_to:
        payload["reply_to"] = reply_to

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )
        r.raise_for_status()
        return r.json()


async def _send_sendgrid(*, to: List[str], subject: str, html: str, text: Optional[str], reply_to: Optional[str]) -> Dict[str, Any]:
    api_key = settings.SENDGRID_API_KEY
    if not api_key:
        raise RuntimeError("SENDGRID_API_KEY is not set")

    from_email = _from_email()
    if "<" in from_email and ">" in from_email:
        name = from_email.split("<")[0].strip().strip('"')
        email = from_email.split("<")[1].split(">")[0].strip()
        from_obj = {"email": email, "name": name}
    else:
        from_obj = {"email": from_email}

    content = [{"type": "text/html", "value": html}]
    if text:
        content.append({"type": "text/plain", "value": text})

    payload: Dict[str, Any] = {
        "personalizations": [{"to": [{"email": e} for e in to]}],
        "from": from_obj,
        "subject": subject,
        "content": content,
    }
    if reply_to:
        payload["reply_to"] = {"email": reply_to}

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )
        if r.status_code not in (200, 202):
            r.raise_for_status()
        return {"status": r.status_code}


# =========================
# Unified send
# =========================
async def send_email(
    *,
    to: List[str],
    subject: str,
    html: str,
    text: Optional[str] = None,
    reply_to: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if not to:
        raise ValueError("No recipients")

    provider = _provider()
    subject = _prefix_env(subject)
    reply_to = reply_to or _reply_to()

    try:
        if provider == "sendgrid":
            resp = await _send_sendgrid(to=to, subject=subject, html=html, text=text, reply_to=reply_to)
        else:
            resp = await _send_resend(to=to, subject=subject, html=html, text=text, reply_to=reply_to)

        logger.info(
            "[email] sent provider=%s to=%s subject=%s meta=%s resp=%s",
            provider, ",".join(to), subject, meta or {}, resp
        )
        return resp

    except Exception as e:
        logger.exception(
            "[email] failed provider=%s to=%s subject=%s meta=%s err=%s",
            provider, ",".join(to), subject, meta or {}, str(e)
        )
        # 이메일 실패가 메인 기능(상담 저장)을 막지 않게 하는 게 일반적이라
        # 여기서는 예외를 다시 던지지 않고 호출부에서 선택적으로 처리하도록 할 수도 있음.
        # 다만, 지금은 호출부에서 try/except로 감싸는 걸 추천.
        raise


# =========================
# Templates (Admin notify)
# =========================
def render_admin_new_contact(contact: Dict[str, Any]) -> Dict[str, str]:
    """
    contact: ORM 객체 대신 dict로 받는 걸 권장 (BackgroundTasks 안전)
    required keys: id, ticket_id, name, phone, email, inquiry_type, message
    """
    detail_url = _build_admin_contact_url(contact.get("id"))
    ticket = _escape(str(contact.get("ticket_id", "")))
    name = _escape(str(contact.get("name", "")))
    phone = _escape(str(contact.get("phone", "")))
    email = _escape(str(contact.get("email", "")))
    inquiry_type = _escape(str(contact.get("inquiry_type", "")))
    message = _escape(str(contact.get("message", "")))

    html = f"""
    <div style="font-family:Arial,sans-serif;line-height:1.55">
      <h2 style="margin:0 0 8px">📩 상담 신청이 접수되었습니다</h2>
      <div style="padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#fafafa">
        <p style="margin:0"><b>티켓</b>: {ticket}</p>
        <p style="margin:4px 0 0"><b>이름</b>: {name}</p>
        <p style="margin:4px 0 0"><b>연락처</b>: {phone}</p>
        <p style="margin:4px 0 0"><b>이메일</b>: {email}</p>
        <p style="margin:4px 0 0"><b>문의유형</b>: {inquiry_type}</p>
      </div>

      <h3 style="margin:16px 0 8px">문의 내용</h3>
      <div style="white-space:pre-wrap;padding:12px;border:1px solid #e5e7eb;border-radius:10px">
        {message}
      </div>

      {"<p style='margin:16px 0'><a href='%s' style='display:inline-block;padding:10px 14px;background:#f97316;color:#fff;border-radius:10px;text-decoration:none'>어드민에서 보기/답변하기</a></p>" % detail_url if detail_url else ""}
    </div>
    """.strip()

    text = (
        f"상담 신청 접수\n"
        f"- 티켓: {contact.get('ticket_id','')}\n"
        f"- 이름: {contact.get('name','')}\n"
        f"- 연락처: {contact.get('phone','')}\n"
        f"- 이메일: {contact.get('email','')}\n"
        f"- 문의유형: {contact.get('inquiry_type','')}\n\n"
        f"[문의 내용]\n{contact.get('message','')}\n\n"
        + (f"어드민 링크: {detail_url}\n" if detail_url else "")
    )

    return {"html": html, "text": text}


# =========================
# Templates (Customer reply)
# =========================

def render_customer_reply(contact: Dict[str, Any], reply_text: str) -> Dict[str, str]:
    site = _public_site_url()
    safe_reply = _escape(reply_text)

    # 선택: 연락처/이메일(있으면 넣기)
    phone = _escape(str(settings.SUPPORT_PHONE))  # 네 데이터 구조에 맞게 조정
    support_email = _escape(str(settings.SUPPORT_EMAIL))  # 없으면 빈 문자열
    customer_name = _escape(str(contact.get("name") or ""))

    # 선택: 티켓/문의유형이 있으면 표시
    ticket_id = _escape(str(contact.get("ticket_id") or ""))
    inquiry_type = _escape(str(contact.get("inquiry_type") or ""))

    meta_line = " · ".join([x for x in [ticket_id and f"티켓 {ticket_id}", inquiry_type and inquiry_type] if x])

    brand = "행복한요양원"

    html = f"""
    <div style="margin:0;padding:0;background:#f6f7fb">
      <div style="max-width:640px;margin:0 auto;padding:24px 12px">
        
        <!-- Header -->
        <div style="padding:18px 18px 14px;border-radius:16px 16px 0 0;background:linear-gradient(135deg,#fb923c,#f97316);color:#fff">
          <div style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;letter-spacing:-0.2px">
            {brand} · 문의 답변
          </div>
          <div style="font-family:Arial,sans-serif;font-size:12px;opacity:0.92;margin-top:6px">
            {meta_line if meta_line else "상담 문의에 대한 답변을 안내드립니다."}
          </div>
        </div>

        <!-- Card -->
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px;box-shadow:0 8px 18px rgba(15,23,42,0.06)">
          <div style="padding:20px 18px 8px;font-family:Arial,sans-serif;color:#111827;line-height:1.65">
            <p style="margin:0 0 10px;font-size:14px">
              안녕하세요{f", {customer_name}님" if customer_name else ""}. {brand}입니다.
            </p>
            <p style="margin:0 0 14px;font-size:14px;color:#374151">
              문의 주셔서 감사합니다. 아래 내용으로 답변드립니다.
            </p>

            <!-- Reply Box -->
            <div style="white-space:pre-wrap;padding:14px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;color:#111827;font-size:14px">
              {safe_reply}
            </div>

            <div style="height:14px"></div>

            <p style="margin:0 0 10px;font-size:13px;color:#374151">
              추가 문의가 있으시면 <b>이 메일로 회신</b>하시거나{(" 전화로 연락" if phone else "")} 부탁드립니다.
            </p>

            <!-- Contact row -->
            <div style="padding:12px 14px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;color:#7c2d12;font-size:12px;line-height:1.5">
              <div style="margin:0 0 6px"><b>연락 안내</b></div>
              {"<div style='margin:0 0 4px'>📞 전화: " + phone + "</div>" if phone else ""}
              {"<div style='margin:0 0 4px'>✉️ 이메일: " + support_email + "</div>" if support_email else ""}
              {("<div style='margin:0'>🌐 웹사이트: " + _escape(site) + "</div>") if site else ""}
            </div>

            <div style="height:18px"></div>

            <!-- Footer note -->
            <div style="border-top:1px solid #f1f5f9;padding:12px 0 4px;color:#6b7280;font-size:11px">
              <div style="margin:0 0 4px">본 메일은 상담 답변 안내 목적으로 발송되었습니다.</div>
              <div style="margin:0">민감한 개인정보(주민번호/계좌번호 등)는 메일로 보내지 마시고, 전화 또는 상담 폼을 이용해 주세요.</div>
            </div>
          </div>
        </div>

        <!-- Bottom spacing -->
        <div style="height:10px"></div>
      </div>
    </div>
    """.strip()

    text_lines = []
    text_lines.append(f"{brand} 문의 답변")
    if meta_line:
        text_lines.append(meta_line)
    text_lines.append("")
    text_lines.append(f"안녕하세요{(', ' + (contact.get('name') or '')) if contact.get('name') else ''}. {brand}입니다.")
    text_lines.append("문의 주셔서 감사합니다. 아래 내용으로 답변드립니다.")
    text_lines.append("")
    text_lines.append(reply_text)
    text_lines.append("")
    text_lines.append("추가 문의는 이 메일로 회신하시거나" + (" 전화로 연락 부탁드립니다." if phone else " 부탁드립니다."))
    if phone:
        text_lines.append(f"전화: {phone}")
    if support_email:
        text_lines.append(f"이메일: {support_email}")
    if site:
        text_lines.append(f"웹사이트: {site}")
    text_lines.append("")
    text_lines.append("※ 민감한 개인정보(주민번호/계좌번호 등)는 메일로 보내지 마시고, 전화 또는 상담 폼을 이용해 주세요.")

    text = "\n".join(text_lines)

    return {"html": html, "text": text}



# =========================
# Public API: notify admins
# =========================
async def notify_admins_new_contact(contact: Dict[str, Any]) -> None:
    to = _admin_recipients()
    if not to:
        logger.warning("[email] MAIL_ADMIN_TO is empty; skip admin notification")
        return

    subject = f"[상담접수] {contact.get('ticket_id','')} {contact.get('name','')}"
    rendered = render_admin_new_contact(contact)

    await send_email(
        to=to,
        subject=subject,
        html=rendered["html"],
        text=rendered.get("text"),
        meta={"type": "admin_notify", "contact_id": contact.get("id")},
    )


# =========================
# Admin reply: send to customer
# =========================
async def send_customer_reply(contact: Dict[str, Any], reply_text: str) -> None:
    email = (contact.get("email") or "").strip()
    if not email:
        logger.info("[email] contact has no email; skip customer reply contact_id=%s", contact.get("id"))
        return

    subject = f"[행복한요양원] 문의 답변드립니다 ({contact.get('ticket_id','')})"
    rendered = render_customer_reply(contact, reply_text)

    await send_email(
        to=[email],
        subject=subject,
        html=rendered["html"],
        text=rendered.get("text"),
        meta={"type": "customer_reply", "contact_id": contact.get("id")},
    )


# =========================
# Utility: ORM -> dict (safe for background tasks)
# =========================
def contact_to_dict(contact) -> Dict[str, Any]:
    return {
        "id": getattr(contact, "id", None),
        "ticket_id": getattr(contact, "ticket_id", ""),
        "name": getattr(contact, "name", ""),
        "phone": getattr(contact, "phone", ""),
        "email": getattr(contact, "email", ""),
        "inquiry_type": getattr(contact, "inquiry_type", ""),
        "message": getattr(contact, "message", ""),
    }
