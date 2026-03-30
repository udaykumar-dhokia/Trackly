from __future__ import annotations

import asyncio
import logging
from html import escape
from urllib.parse import quote

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.models.orm import Project, User, WelcomeEmailDelivery
from app.models.schemas import ProjectBudgetStatusResponse

logger = logging.getLogger(__name__)


WELCOME_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Welcome to Trackly</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  html, body { margin: 0; padding: 0; height: 100% !important; width: 100% !important; background: #09090b; }
  * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; box-sizing: border-box; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  table { border-spacing: 0 !important; border-collapse: collapse; margin: 0 auto; }
  img { -ms-interpolation-mode: bicubic; border: 0 !important; outline: none !important; text-decoration: none !important; }
  
  body { 
    background-color: #09090b; 
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
    font-size: 15px; 
    line-height: 1.6; 
    color: #a1a1aa;
    -webkit-font-smoothing: antialiased;
  }

  .email-container { width: 600px; max-width: 600px; margin: 40px auto; }
  .email-card { 
    background: #0f0f12; 
    border: 1px solid rgba(255,255,255,0.06); 
    border-radius: 16px; 
    overflow: hidden; 
  }
  
  .header { padding: 40px 48px 32px; text-align: center; }
  .logo-dot { height: 10px; width: 10px; background-color: #a78bfa; border-radius: 50%; display: inline-block; box-shadow: 0 0 10px rgba(167,139,250,0.5); }
  .logo-text { font-size: 18px; font-weight: 800; color: #f4f4f5; letter-spacing: -0.02em; margin-left: 8px; vertical-align: middle; }
  
  .hero-text { font-size: 28px; font-weight: 800; color: #f8fafc; line-height: 1.2; margin: 24px 0 12px; letter-spacing: -0.03em; }
  .accent { color: #a78bfa; }
  .sub-text { font-size: 14px; color: #71717a; margin-bottom: 0; }
  
  .body-content { padding: 0 48px 40px; }
  .section-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 32px 0; }
  
  .step-row { margin-bottom: 24px; }
  .step-num { 
    width: 28px; height: 28px; 
    background: rgba(167,139,250,0.1); 
    border: 1px solid rgba(167,139,250,0.2); 
    border-radius: 7px; 
    color: #a78bfa; 
    font-size: 12px; 
    font-weight: 700; 
    text-align: center;
    line-height: 26px;
    display: inline-block;
    margin-right: 12px;
  }
  .step-title { font-size: 14px; font-weight: 600; color: #f4f4f5; display: inline-block; vertical-align: top; margin-top: 4px; }
  .step-desc { font-size: 13px; color: #71717a; padding-left: 40px; margin-top: 4px; }
  
  .code-block { 
    background: #060608; 
    border: 1px solid rgba(255,255,255,0.05); 
    border-radius: 10px; 
    padding: 16px; 
    margin-top: 12px; 
    font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace; 
    font-size: 12px; 
    color: #a1a1aa; 
    line-height: 1.5;
  }
  .kw { color: #c084fc; }
  .st { color: #86efac; }
  .cm { color: #52525b; }
  
  .cta-button { 
    display: block; 
    background: #a78bfa; 
    color: #09090b !important; 
    text-decoration: none; 
    text-align: center; 
    padding: 14px 32px; 
    border-radius: 10px; 
    font-weight: 700; 
    font-size: 15px; 
    margin: 32px 0 16px;
    box-shadow: 0 4px 15px rgba(167,139,250,0.3);
  }
  
  .stats-grid { table-layout: fixed; width: 100%; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; background: rgba(255,255,255,0.02); }
  .stat-item { padding: 16px 8px; text-align: center; border-right: 1px solid rgba(255,255,255,0.05); }
  .stat-val { display: block; font-size: 16px; font-weight: 700; color: #f4f4f5; margin-bottom: 2px; }
  .stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #52525b; }
  
  .footer { padding: 32px 48px; text-align: center; background: #0a0a0c; border-top: 1px solid rgba(255,255,255,0.04); }
  .footer-links a { color: #52525b; text-decoration: none; font-size: 12px; margin: 0 12px; }
  .footer-text { font-size: 11px; color: #3f3f46; margin-top: 16px; }

  @media screen and (max-width: 600px) {
    .email-container { width: 100% !important; margin: 0 auto !important; }
    .email-card { border-radius: 0 !important; border-left: none !important; border-right: none !important; }
    .header, .body-content { padding-left: 20px !important; padding-right: 20px !important; }
    .stat-item { padding: 12px 4px !important; }
  }
</style>
</head>
<body>
<div class="email-container">
  <div class="email-card">
    <div class="header">
      <h1 class="hero-text">Welcome aboard, <span class="accent">{{first_name}}</span></h1>
      <p class="sub-text">Let's get your first LLM call tracked in under 5 minutes.</p>
    </div>
    
    <div class="body-content">
      <div class="section-divider"></div>
      
      <div class="step-row">
        <div class="step-num">1</div>
        <div class="step-title">Install the SDK</div>
        <div class="step-desc">
          Run this in your terminal to get the client:
          <div class="code-block">pip install trackly</div>
        </div>
      </div>
      
      <div class="step-row">
        <div class="step-num">2</div>
        <div class="step-title">Get your API Key</div>
        <div class="step-desc">
          Create a project in your dashboard and generate an API key from <strong style="color:#f4f4f5">Settings &gt; API Keys</strong>.
        </div>
      </div>
      
      <div class="step-row">
        <div class="step-num">3</div>
        <div class="step-title">Configure Environment</div>
        <div class="step-desc">
          Add the key to your .env file:
          <div class="code-block"><span class="kw">TRACKLY_API_KEY</span>=<span class="st">"your_api_key_here"</span></div>
        </div>
      </div>
      
      <div class="step-row">
        <div class="step-num">4</div>
        <div class="step-title">Start Tracking</div>
        <div class="step-desc">
          Wrap your LangChain or native LLM calls:
          <div class="code-block">
            <span class="kw">from</span> trackly <span class="kw">import</span> Trackly<br>
            trackly = Trackly()<br>
            <span class="cm"># Add trackly.callback() to your model</span>
          </div>
        </div>
      </div>
      
      <a href="{{dashboard_url}}" class="cta-button">Open your dashboard &rarr;</a>
      
      <table class="stats-grid">
        <tr>
          <td class="stat-item"><span class="stat-val">6+</span><span class="stat-label">Providers</span></td>
          <td class="stat-item"><span class="stat-val">2</span><span class="stat-label">LOC</span></td>
          <td class="stat-item"><span class="stat-val">0ms</span><span class="stat-label">Latency</span></td>
          <td style="border:none" class="stat-item"><span class="stat-val">Free</span><span class="stat-label">To Start</span></td>
        </tr>
      </table>
    </div>
    
    <div class="footer">
      <div class="footer-links">
        <a href="{{docs_url}}">Documentation</a>
        <a href="https://github.com/udaykumar-dhokia/Trackly">GitHub</a>
        <a href="{{contact_url}}">Support</a>
      </div>
      <p class="footer-text">
        &copy; 2026 Trackly AI &middot; Ahmedabad, India<br>
        You're receiving this because you signed up at tracklyai.in.<br>
        <a href="{{unsubscribe_url}}" style="color:#52525b; text-decoration:underline;">Unsubscribe</a>
      </p>
    </div>
  </div>
</div>
</body>
</html>
"""

PROJECT_BUDGET_ALERT_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Trackly Project Budget Alert</title>
</head>
<body style="margin:0;padding:24px;background:#09090b;color:#e4e4e7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:620px;margin:0 auto;background:#111114;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;">
    <div style="padding:28px 32px 16px;">
      <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#71717a;">Budget Alert</div>
      <h1 style="margin:10px 0 8px;font-size:28px;line-height:1.15;color:#fafafa;">{project_name} has crossed 90% of its monthly budget.</h1>
      <p style="margin:0;color:#a1a1aa;font-size:14px;line-height:1.7;">Trackly detected that project usage is now in the caution zone for this billing cycle.</p>
    </div>
    <div style="padding:0 32px 24px;">
      <div style="background:#0a0a0c;border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:18px 20px;">
        <p style="margin:0 0 10px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Current Usage</p>
        <p style="margin:0 0 8px;font-size:15px;color:#f4f4f5;">Estimated spend: <strong>{cost_summary}</strong></p>
        <p style="margin:0;font-size:15px;color:#f4f4f5;">Token usage: <strong>{token_summary}</strong></p>
      </div>
      <a href="{dashboard_url}" style="display:inline-block;margin-top:20px;background:#f4f4f5;color:#09090b;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;">Open project budgets</a>
    </div>
  </div>
</body>
</html>
"""



def _first_name(user: User) -> str:
    if user.name:
        return user.name.strip().split()[0]
    return user.email.split("@")[0].strip() or "there"


def build_welcome_email_html(user: User) -> str:
    dashboard_url = settings.app_base_url.rstrip("/")
    docs_url = f"{dashboard_url}/docs"
    contact_url = f"{dashboard_url}#contact"
    
    unsubscribe_url = f"{settings.app_base_url.rstrip('/')}/unsubscribe"
    if hasattr(user, 'resend_contact_id') and user.resend_contact_id:
        unsubscribe_url += (
            f"?audience_id={quote(settings.resend_audience_id)}"
            f"&id={quote(user.resend_contact_id)}"
        )
    else:
        unsubscribe_url = f"mailto:{settings.support_email}?subject=Unsubscribe%20from%20Trackly%20emails"

    return (
        WELCOME_TEMPLATE
        .replace("{{first_name}}", escape(_first_name(user)))
        .replace("{{dashboard_url}}", escape(dashboard_url))
        .replace("{{docs_url}}", escape(docs_url))
        .replace("{{docs_host}}", escape(docs_url.replace("https://", "").replace("http://", "")))
        .replace("{{contact_url}}", escape(contact_url))
        .replace("{{unsubscribe_url}}", escape(unsubscribe_url))
    )


def build_project_budget_alert_email_html(
    project: Project,
    budget_status: ProjectBudgetStatusResponse,
) -> str:
    dashboard_url = f"{settings.app_base_url.rstrip('/')}/budgets"
    cost_summary = (
        f"${budget_status.current_month_cost_usd:.4f} / ${budget_status.monthly_cost_limit_usd:.2f}"
        if budget_status.monthly_cost_limit_usd is not None
        else f"${budget_status.current_month_cost_usd:.4f}"
    )
    token_summary = (
        f"{budget_status.current_month_tokens:,} / {budget_status.monthly_token_limit:,}"
        if budget_status.monthly_token_limit is not None
        else f"{budget_status.current_month_tokens:,}"
    )

    return PROJECT_BUDGET_ALERT_TEMPLATE.format(
        project_name=escape(project.name),
        cost_summary=escape(cost_summary),
        token_summary=escape(token_summary),
        dashboard_url=escape(dashboard_url),
    )


def _post_resend_email(payload: dict[str, object]) -> object:
    import resend

    resend.api_key = settings.resend_api_key
    return resend.Emails.send(payload)


def _extract_message_id(result: object) -> str | None:
    if isinstance(result, dict):
        value = result.get("id")
        return str(value) if value else None

    value = getattr(result, "id", None)
    return str(value) if value else None


async def ensure_welcome_email_sent(db: AsyncSession, user: User) -> bool:
    existing = await db.execute(
        select(WelcomeEmailDelivery).where(WelcomeEmailDelivery.user_id == user.id)
    )
    if existing.scalar_one_or_none() is not None:
        logger.info("Welcome email skipped for %s: already recorded.", user.email)
        return False

    if not settings.resend_api_key:
        logger.warning("Welcome email skipped for %s: RESEND_API_KEY is missing.", user.email)
        return False

    delivery = WelcomeEmailDelivery(
        user_id=user.id,
        sent_to_email=user.email,
        provider="resend",
        provider_message_id=None,
    )
    db.add(delivery)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        logger.info(
            "Welcome email skipped for %s: delivery row already exists.",
            user.email,
        )
        return False

    payload = {
        "from": settings.resend_from_email,
        "to": [user.email],
        "subject": "Welcome to Trackly",
        "html": build_welcome_email_html(user),
    }

    try:
        result = await asyncio.to_thread(_post_resend_email, payload)
    except Exception as exc:
        await db.delete(delivery)
        await db.flush()
        logger.exception("Welcome email failed for %s: %s", user.email, exc)
        return False

    delivery.provider_message_id = _extract_message_id(result)
    logger.info(
        "Welcome email sent to %s via Resend. message_id=%s",
        user.email,
        delivery.provider_message_id,
    )
    return True


async def send_project_budget_alert_email(
    *,
    project: Project,
    owners: list[User],
    budget_status: ProjectBudgetStatusResponse,
) -> bool:
    if not settings.resend_api_key or not owners:
        return False

    payload = {
        "from": settings.resend_from_email,
        "to": [owner.email for owner in owners],
        "subject": f"Trackly alert: {project.name} crossed 90% of its monthly budget",
        "html": build_project_budget_alert_email_html(project, budget_status),
    }

    try:
        result = await asyncio.to_thread(_post_resend_email, payload)
    except Exception as exc:
        logger.exception("Project budget alert email failed for %s: %s", project.name, exc)
        return False

    logger.info(
        "Project budget alert sent for %s. message_id=%s",
        project.name,
        _extract_message_id(result),
    )
    return True


def unsubscribe_contact(audience_id: str, contact_id: str) -> bool:
    """
    Unsubscribes a contact from a Resend audience.
    """
    import resend
    if not settings.resend_api_key:
        logger.error("RESEND_API_KEY is missing")
        return False

    resend.api_key = settings.resend_api_key
    try:
        resend.Contacts.update({
            "audience_id": audience_id,
            "id": contact_id,
            "unsubscribed": True,
        })
        logger.info("Successfully unsubscribed contact %s from audience %s", contact_id, audience_id)
        return True
    except Exception as exc:
        logger.exception("Failed to unsubscribe contact %s: %s", contact_id, exc)
        return False
