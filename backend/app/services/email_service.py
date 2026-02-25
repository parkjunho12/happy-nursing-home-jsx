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
    return "Happy Nursing Home <contact@example.com>"


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
    contact: dict 권장 (BackgroundTasks 안전)
    required keys: id, ticket_id, name, phone, email, inquiry_type, message
    """
    detail_url_raw = _build_admin_contact_url(contact.get("id")) or ""
    detail_url = _escape(detail_url_raw)

    ticket = _escape(str(contact.get("ticket_id", "")))
    name = _escape(str(contact.get("name", "")))
    phone = _escape(str(contact.get("phone", "")))
    email = _escape(str(contact.get("email", "")))
    inquiry_type = _escape(str(contact.get("inquiry_type", "")))
    message = _escape(str(contact.get("message", "")))

    # HTML: 단순하고 ‘업무 알림’ 톤으로
    html = f"""
    <!doctype html>
    <html>
    <body style="margin:0;padding:0;font-family:Arial,sans-serif;line-height:1.55;color:#111827">
        <div style="max-width:640px;margin:0 auto;padding:20px">
        <h2 style="margin:0 0 12px;font-size:18px;font-weight:700">
            상담 접수 알림
        </h2>
        <p style="margin:0 0 14px;color:#374151;font-size:13px">
            홈페이지 상담폼을 통해 새 문의가 접수되어 안내드립니다.
        </p>

        <div style="padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#fafafa">
            <p style="margin:0"><b>티켓</b>: {ticket}</p>
            <p style="margin:6px 0 0"><b>이름</b>: {name}</p>
            <p style="margin:6px 0 0"><b>연락처</b>: {phone}</p>
            <p style="margin:6px 0 0"><b>이메일</b>: {email}</p>
            <p style="margin:6px 0 0"><b>문의유형</b>: {inquiry_type}</p>
        </div>

        <h3 style="margin:16px 0 8px;font-size:15px">문의 내용</h3>
        <div style="white-space:pre-wrap;padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#ffffff">
    {message}
        </div>

        {"<p style='margin:14px 0 0;font-size:13px'>어드민에서 확인: <a href='%s'>%s</a></p>" % (detail_url, detail_url) if detail_url_raw else ""}

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0">

        <p style="margin:0;color:#6b7280;font-size:12px">
            이 메일은 상담 접수 알림(업무용)입니다. 필요 시 이 메일에 회신하여 내부 메모를 남겨도 됩니다.<br>
            행복한요양원 상담팀
        </p>
        </div>
    </body>
    </html>
        """.strip()

    # TEXT: 스팸 점수 낮추는 데 매우 중요
    text_lines = [
        "상담 접수 알림",
        "홈페이지 상담폼을 통해 새 문의가 접수되어 안내드립니다.",
        "",
        f"- 티켓: {contact.get('ticket_id','')}",
        f"- 이름: {contact.get('name','')}",
        f"- 연락처: {contact.get('phone','')}",
        f"- 이메일: {contact.get('email','')}",
        f"- 문의유형: {contact.get('inquiry_type','')}",
        "",
        "[문의 내용]",
        str(contact.get("message", "")),
        "",
    ]
    if detail_url_raw:
        text_lines.append(f"어드민 링크: {detail_url_raw}")
        text_lines.append("")

    text_lines += [
        "이 메일은 상담 접수 알림(업무용)입니다.",
        "행복한요양원 상담팀",
    ]

    return {"html": html, "text": "\n".join(text_lines)}


# =========================
# Templates (Customer reply)
# =========================

def render_customer_reply(contact: Dict[str, Any], reply_text: str) -> Dict[str, str]:
    site_raw = _public_site_url() or ""
    site = _escape(site_raw)

    safe_reply = _escape(reply_text)

    # settings 값이 None이면 "None" 문자열이 들어가는 것 방지
    phone_raw = getattr(settings, "SUPPORT_PHONE", "") or ""
    support_email_raw = getattr(settings, "SUPPORT_EMAIL", "") or ""

    phone = _escape(str(phone_raw))
    support_email = _escape(str(support_email_raw))

    customer_name = _escape(str(contact.get("name") or ""))

    ticket_id = _escape(str(contact.get("ticket_id") or ""))
    inquiry_type = _escape(str(contact.get("inquiry_type") or ""))

    meta_line = " · ".join([x for x in [ticket_id and f"티켓 {ticket_id}", inquiry_type and inquiry_type] if x])

    brand = "행복한요양원"

    html = f"""
    <!doctype html>
    <html>
    <body style="margin:0;padding:0;background:#ffffff">
        <div style="max-width:640px;margin:0 auto;padding:20px 14px;font-family:Arial,sans-serif;line-height:1.6;color:#111827">

        <!-- Header (solid color, no gradient) -->
        <div style="padding:14px 16px;border:1px solid #e5e7eb;border-radius:12px;background:#fff7ed">
            <div style="font-size:16px;font-weight:700">
            {brand} 문의 답변
            </div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px">
            {meta_line if meta_line else "상담 문의에 대한 답변을 안내드립니다."}
            </div>
        </div>

        <!-- Why you got this email -->
        <p style="margin:14px 2px 10px;font-size:12px;color:#6b7280">
            본 메일은 {brand} 홈페이지 상담폼 문의에 대한 답변 안내입니다.
        </p>

        <!-- Body -->
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;background:#ffffff">
            <p style="margin:0 0 10px;font-size:14px">
            안녕하세요{f", {customer_name}님" if customer_name else ""}. {brand}입니다.
            </p>

            <p style="margin:0 0 12px;font-size:14px;color:#374151">
            문의 주셔서 감사합니다. 아래 내용으로 답변드립니다.
            </p>

            <!-- Reply Box -->
            <div style="white-space:pre-wrap;padding:12px 12px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;color:#111827;font-size:14px">
    {safe_reply}
            </div>

            <p style="margin:12px 0 0;font-size:13px;color:#374151">
            추가 문의가 있으시면 <b>이 메일로 회신</b>하시거나{(" 전화로 연락" if phone_raw else "")} 부탁드립니다.
            </p>

            <!-- Contact -->
            <div style="margin-top:12px;padding:12px 12px;border-radius:10px;background:#fafafa;border:1px solid #e5e7eb;font-size:12px;color:#374151">
            <div style="margin:0 0 6px;font-weight:700;color:#111827">연락 안내</div>
            {"<div style='margin:0 0 4px'>전화: " + phone + "</div>" if phone_raw else ""}
            {"<div style='margin:0 0 4px'>이메일: " + support_email + "</div>" if support_email_raw else ""}
            {("<div style='margin:0'>홈페이지: <a href='" + site + "'>" + site + "</a></div>") if site_raw else ""}
            </div>

            <!-- Footer note -->
            <div style="margin-top:14px;padding-top:10px;border-top:1px solid #f1f5f9;color:#6b7280;font-size:11px">
            <div style="margin:0 0 4px">본 메일은 상담 답변 안내 목적으로 발송되었습니다.</div>
            <div style="margin:0">민감한 개인정보(주민번호/계좌번호 등)는 메일로 보내지 마시고, 전화 또는 상담 폼을 이용해 주세요.</div>
            </div>
        </div>
        </div>
    </body>
    </html>
        """.strip()

    text_lines = []
    text_lines.append(f"{brand} 문의 답변")
    if meta_line:
        text_lines.append(meta_line)

    text_lines.append("")
    # 이름은 escape하지 않은 원문을 그대로 쓰는 게 더 자연스러워서 기존 방식 유지(원하면 escape 적용 가능)
    raw_name = (contact.get("name") or "").strip()
    text_lines.append(f"안녕하세요{(', ' + raw_name) if raw_name else ''}. {brand}입니다.")
    text_lines.append("문의 주셔서 감사합니다. 아래 내용으로 답변드립니다.")
    text_lines.append("")
    text_lines.append(reply_text)
    text_lines.append("")
    text_lines.append("추가 문의는 이 메일로 회신하시거나" + (" 전화로 연락 부탁드립니다." if phone_raw else " 부탁드립니다."))
    if phone_raw:
        text_lines.append(f"전화: {phone_raw}")
    if support_email_raw:
        text_lines.append(f"이메일: {support_email_raw}")
    if site_raw:
        text_lines.append(f"홈페이지: {site_raw}")
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
