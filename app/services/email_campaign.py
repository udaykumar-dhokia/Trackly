from __future__ import annotations

import asyncio
import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote

from app.config import settings

PLACEHOLDER_RE = re.compile(r"{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}")


class CampaignError(ValueError):
    pass


@dataclass(slots=True)
class Recipient:
    email: str
    fields: dict[str, str]


@dataclass(slots=True)
class RenderedEmail:
    to_email: str
    subject: str
    html: str | None
    text: str | None


@dataclass(slots=True)
class SendResult:
    email: str
    success: bool
    message_id: str | None = None
    error: str | None = None


def extract_placeholders(template: str) -> set[str]:
    return {match.group(1) for match in PLACEHOLDER_RE.finditer(template)}


def render_template(template: str, fields: dict[str, str]) -> str:
    missing = sorted({name for name in extract_placeholders(template) if not fields.get(name)})
    if missing:
        raise CampaignError(f"Missing template values for: {', '.join(missing)}")

    def replace(match: re.Match[str]) -> str:
        return fields[match.group(1)].strip()

    return PLACEHOLDER_RE.sub(replace, template)


def load_template(path: str | Path | None) -> str | None:
    if path is None:
        return None
    return Path(path).read_text(encoding="utf-8-sig")


def load_recipients(csv_path: str | Path) -> list[Recipient]:
    path = Path(csv_path)
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise CampaignError("Recipient CSV must include a header row.")
        if "email" not in reader.fieldnames:
            raise CampaignError("Recipient CSV must include an 'email' column.")

        recipients: list[Recipient] = []
        for index, row in enumerate(reader, start=2):
            normalized = {
                (key or "").strip(): (value or "").strip()
                for key, value in row.items()
                if key is not None
            }
            email = normalized.get("email", "")
            if not email:
                raise CampaignError(f"Row {index} is missing an email value.")
            fields = {key: value for key, value in normalized.items() if key}
            recipients.append(Recipient(email=email, fields=fields))

    if not recipients:
        raise CampaignError("Recipient CSV does not contain any rows.")

    return recipients


def build_unsubscribe_url(contact_id: str | None) -> str:
    if contact_id and settings.resend_audience_id:
        return (
            f"{settings.app_base_url.rstrip('/')}/unsubscribe"
            f"?audience_id={quote(settings.resend_audience_id)}&id={quote(contact_id)}"
        )
    return f"mailto:{settings.support_email}?subject=Unsubscribe%20from%20Trackly%20emails"


def _extract_contact_id(result: object) -> str | None:
    if isinstance(result, dict):
        if isinstance(result.get("data"), dict):
            value = result["data"].get("id")
            if value:
                return str(value)
        value = result.get("id")
        return str(value) if value else None

    data = getattr(result, "data", None)
    if data is not None:
        value = getattr(data, "id", None)
        if value:
            return str(value)

    value = getattr(result, "id", None)
    return str(value) if value else None


def _ensure_contact(email: str, fields: dict[str, str]) -> str | None:
    import resend

    if not settings.resend_api_key:
        raise CampaignError("RESEND_API_KEY is missing.")
    if not settings.resend_audience_id:
        return None

    resend.api_key = settings.resend_api_key

    first_name = fields.get("first_name") or fields.get("name", "").split(" ")[0].strip()
    last_name = fields.get("last_name") or ""
    payload: dict[str, Any] = {
        "audience_id": settings.resend_audience_id,
        "email": email,
        "unsubscribed": False,
    }
    if first_name:
        payload["first_name"] = first_name
    if last_name:
        payload["last_name"] = last_name

    try:
        result = resend.Contacts.create(payload)
        return _extract_contact_id(result)
    except Exception as exc:
        message = str(exc).lower()
        if "already exists" not in message and "exists" not in message and "409" not in message:
            raise

    result = resend.Contacts.update(payload)
    return _extract_contact_id(result)


async def enrich_recipients_for_sending(
    recipients: list[Recipient],
    *,
    concurrency: int = 5,
) -> list[Recipient]:
    if concurrency < 1:
        raise CampaignError("Concurrency must be at least 1.")

    semaphore = asyncio.Semaphore(concurrency)

    async def enrich(recipient: Recipient) -> Recipient:
        async with semaphore:
            contact_id = await asyncio.to_thread(_ensure_contact, recipient.email, recipient.fields)

        fields = dict(recipient.fields)
        fields["unsubscribe_url"] = build_unsubscribe_url(contact_id)
        return Recipient(email=recipient.email, fields=fields)

    return await asyncio.gather(*(enrich(recipient) for recipient in recipients))


def render_campaign(
    recipients: list[Recipient],
    subject_template: str,
    html_template: str | None,
    text_template: str | None,
) -> list[RenderedEmail]:
    if not html_template and not text_template:
        raise CampaignError("Provide at least one body template: HTML or text.")

    rendered: list[RenderedEmail] = []
    for recipient in recipients:
        try:
            subject = render_template(subject_template, recipient.fields)
            html = render_template(html_template, recipient.fields) if html_template else None
            text = render_template(text_template, recipient.fields) if text_template else None
        except CampaignError as exc:
            raise CampaignError(f"{recipient.email}: {exc}") from exc

        rendered.append(
            RenderedEmail(
                to_email=recipient.email,
                subject=subject,
                html=html,
                text=text,
            )
        )
    return rendered


def _post_email(payload: dict[str, Any]) -> object:
    import resend

    resend.api_key = settings.resend_api_key
    return resend.Emails.send(payload)


def _extract_message_id(result: object) -> str | None:
    if isinstance(result, dict):
        value = result.get("id")
        return str(value) if value else None
    value = getattr(result, "id", None)
    return str(value) if value else None


async def send_campaign(
    emails: list[RenderedEmail],
    *,
    from_email: str | None = None,
    reply_to: str | None = None,
    concurrency: int = 5,
) -> list[SendResult]:
    if not settings.resend_api_key:
        raise CampaignError("RESEND_API_KEY is missing.")
    if concurrency < 1:
        raise CampaignError("Concurrency must be at least 1.")

    sender = from_email or settings.resend_from_email
    semaphore = asyncio.Semaphore(concurrency)

    async def send_one(email: RenderedEmail) -> SendResult:
        payload: dict[str, Any] = {
            "from": sender,
            "to": [email.to_email],
            "subject": email.subject,
        }
        if email.html:
            payload["html"] = email.html
        if email.text:
            payload["text"] = email.text
        if reply_to:
            payload["reply_to"] = reply_to

        async with semaphore:
            try:
                result = await asyncio.to_thread(_post_email, payload)
            except Exception as exc:
                return SendResult(email=email.to_email, success=False, error=str(exc))

        return SendResult(
            email=email.to_email,
            success=True,
            message_id=_extract_message_id(result),
        )

    return await asyncio.gather(*(send_one(email) for email in emails))
