from __future__ import annotations

import asyncio
import logging
from html import escape

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.models.orm import User, WelcomeEmailDelivery

logger = logging.getLogger(__name__)


WELCOME_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>Welcome to Trackly</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .email-wrapper { background: #09090b; padding: 40px 16px; }
  .email-card {
    max-width: 560px; margin: 0 auto;
    background: #0f0f12;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    overflow: hidden;
  }
  .header {
    background: linear-gradient(135deg, rgba(167,139,250,0.12) 0%, rgba(167,139,250,0.03) 100%);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    padding: 36px 40px 32px;
    text-align: center;
    position: relative;
  }
  .logo-row {
    display: inline-flex; align-items: center; gap: 8px;
    margin-bottom: 24px;
  }
  .logo-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #a78bfa;
    box-shadow: 0 0 8px #a78bfa;
    display: inline-block;
  }
  .logo-text {
    font-size: 15px; font-weight: 700;
    letter-spacing: -0.02em; color: #f4f4f5;
  }
  .header-greeting {
    font-size: 26px; font-weight: 800;
    letter-spacing: -0.035em; color: #f4f4f5;
    line-height: 1.2; margin-bottom: 10px;
  }
  .header-greeting .accent { color: #a78bfa; }
  .header-sub {
    font-size: 14px; color: #71717a; line-height: 1.65;
  }
  .body { padding: 36px 40px; }
  .intro {
    font-size: 14px; color: #a1a1aa; line-height: 1.75;
    margin-bottom: 32px;
    padding-bottom: 28px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .intro strong { color: #f4f4f5; font-weight: 600; }
  .steps-label {
    font-size: 10px; font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; color: #52525b;
    margin-bottom: 18px;
    display: flex; align-items: center; gap: 8px;
  }
  .steps-label::after {
    content: ''; flex: 1; height: 1px;
    background: rgba(255,255,255,0.06);
  }
  .step {
    display: flex; gap: 16px; margin-bottom: 0;
    position: relative;
  }
  .step-line {
    position: absolute;
    left: 15px; top: 36px; bottom: -20px;
    width: 1px; background: rgba(255,255,255,0.06);
  }
  .step:last-of-type .step-line { display: none; }
  .step-num {
    width: 30px; height: 30px; border-radius: 8px;
    background: rgba(167,139,250,0.1);
    border: 1px solid rgba(167,139,250,0.25);
    color: #a78bfa; font-size: 12px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; position: relative; z-index: 1;
    margin-top: 1px;
  }
  .step-content { flex: 1; padding-bottom: 22px; }
  .step-title {
    font-size: 13px; font-weight: 600;
    color: #f4f4f5; margin-bottom: 4px;
  }
  .step-desc {
    font-size: 12.5px; color: #71717a; line-height: 1.65;
  }
  .step-desc code {
    font-family: 'Courier New', monospace; font-size: 11.5px;
    background: #141418; border: 1px solid rgba(255,255,255,0.08);
    color: #f4f4f5; padding: 1px 6px; border-radius: 4px;
  }
  .code-block {
    background: #060608; border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px; overflow: hidden; margin-top: 10px;
  }
  .code-topbar {
    display: flex; align-items: center; gap: 5px;
    padding: 9px 14px; border-bottom: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.015);
  }
  .cd { width: 9px; height: 9px; border-radius: 50%; }
  .code-filename {
    font-family: monospace; font-size: 10px;
    color: #52525b; margin-left: 6px;
  }
  .code-pre {
    padding: 14px 16px; font-family: 'Courier New', monospace;
    font-size: 11.5px; line-height: 1.8; color: #a1a1aa;
    white-space: pre;
  }
  .kw  { color: #c084fc; }
  .fn  { color: #93c5fd; }
  .st  { color: #86efac; }
  .cm  { color: #52525b; }
  .va  { color: #fde68a; }
  .cta-wrap {
    text-align: center; padding: 28px 0 8px;
    border-top: 1px solid rgba(255,255,255,0.06);
    margin-top: 28px;
  }
  .cta-btn {
    display: inline-block;
    background: #a78bfa; color: #09090b;
    font-size: 14px; font-weight: 700;
    letter-spacing: 0.01em;
    padding: 13px 32px; border-radius: 9px;
    text-decoration: none;
    box-shadow: 0 0 24px rgba(167,139,250,0.35);
  }
  .cta-hint {
    font-size: 12px; color: #52525b; margin-top: 10px;
  }
  .stats-row {
    display: flex; border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px; overflow: hidden;
    background: #141418; margin: 28px 0;
  }
  .stat-cell {
    flex: 1; padding: 14px 16px; text-align: center;
    border-right: 1px solid rgba(255,255,255,0.06);
  }
  .stat-cell:last-child { border-right: none; }
  .stat-num {
    font-size: 18px; font-weight: 700;
    color: #f4f4f5; letter-spacing: -0.03em;
    display: block; margin-bottom: 3px;
  }
  .stat-num.purple { color: #a78bfa; }
  .stat-num.green  { color: #34d399; }
  .stat-label {
    font-family: monospace; font-size: 9.5px;
    color: #52525b; text-transform: uppercase; letter-spacing: 0.06em;
  }
  .footer {
    padding: 24px 40px;
    border-top: 1px solid rgba(255,255,255,0.05);
    background: #0a0a0d;
    text-align: center;
  }
  .footer-logo {
    display: inline-flex; align-items: center;
    gap: 6px; margin-bottom: 10px;
  }
  .footer-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #a78bfa; display: inline-block;
  }
  .footer-name {
    font-size: 13px; font-weight: 700;
    color: #f4f4f5; letter-spacing: -0.02em;
  }
  .footer-links {
    margin-bottom: 10px;
  }
  .footer-links a {
    font-size: 11.5px; color: #52525b;
    text-decoration: none; margin: 0 10px;
  }
  .footer-copy {
    font-size: 11px; color: #3f3f46; line-height: 1.6;
  }
  .footer-copy a { color: #52525b; text-decoration: none; }
  .pre-header { display: none; max-height: 0; overflow: hidden; }
</style>
</head>
<body>
<div class="pre-header">
  Welcome to Trackly - start tracking your LLM costs in 2 lines of code.
</div>
<div class="email-wrapper">
<div class="email-card">
  <div class="header">
    <div class="logo-row">
      <span class="logo-text">Trackly</span>
    </div>
    <h1 class="header-greeting">
      Welcome aboard,<br>
      <span class="accent">{{first_name}} &#128075;</span>
    </h1>
    <p class="header-sub">
      You're in. Let's get your first LLM call tracked.
    </p>
  </div>
  <div class="body">
    <p class="intro">
      Thanks for signing up for Trackly. You now have everything you need to
      <strong>track tokens, cost, and latency</strong> across every LLM provider
      you use - OpenAI, Anthropic, Groq, Gemini, Ollama, and more.
      <br><br>
      It takes <strong>under 5 minutes</strong> to go from zero to fully tracked.
      Here's exactly how.
    </p>
    <div class="steps-label">Getting started</div>
    <div class="step">
      <div class="step-line"></div>
      <div class="step-num">1</div>
      <div class="step-content">
        <div class="step-title">Install the SDK</div>
        <div class="step-desc">
          Open your terminal and run:
          <div class="code-block" style="margin-top:8px">
            <div class="code-topbar">
              <span class="cd" style="background:#ff5f57"></span>
              <span class="cd" style="background:#febc2e"></span>
              <span class="cd" style="background:#28c840"></span>
              <span class="code-filename">terminal</span>
            </div>
            <div class="code-pre">pip install trackly

<span class="cm"># with your provider</span>
pip install <span class="st">"trackly[openai]"</span>
pip install <span class="st">"trackly[groq]"</span></div>
          </div>
        </div>
      </div>
    </div>
    <div class="step">
      <div class="step-line"></div>
      <div class="step-num">2</div>
      <div class="step-content">
        <div class="step-title">Create a project &amp; generate an API key</div>
        <div class="step-desc">
          Go to your <strong style="color:#f4f4f5">Dashboard -&gt; Projects -&gt; New Project</strong>,
          then head to <strong style="color:#f4f4f5">API Keys</strong> and click Generate.
          Copy the key immediately - it's shown only once.
        </div>
      </div>
    </div>
    <div class="step">
      <div class="step-line"></div>
      <div class="step-num">3</div>
      <div class="step-content">
        <div class="step-title">Add your key to the environment</div>
        <div class="step-desc">
          <div class="code-block" style="margin-top:4px">
            <div class="code-topbar">
              <span class="cd" style="background:#ff5f57"></span>
              <span class="cd" style="background:#febc2e"></span>
              <span class="cd" style="background:#28c840"></span>
              <span class="code-filename">.env</span>
            </div>
            <div class="code-pre"><span class="va">TRACKLY_API_KEY</span>=<span class="st">tk_live_your_key_here</span></div>
          </div>
        </div>
      </div>
    </div>
    <div class="step">
      <div class="step-num">4</div>
      <div class="step-content">
        <div class="step-title">Wrap your LLM &amp; start tracking</div>
        <div class="step-desc">
          Two lines. Your existing code doesn't change.
          <div class="code-block" style="margin-top:8px">
            <div class="code-topbar">
              <span class="cd" style="background:#ff5f57"></span>
              <span class="cd" style="background:#febc2e"></span>
              <span class="cd" style="background:#28c840"></span>
              <span class="code-filename">main.py</span>
            </div>
            <div class="code-pre"><span class="kw">from</span> trackly <span class="kw">import</span> <span class="fn">Trackly</span>
<span class="kw">from</span> langchain_openai <span class="kw">import</span> <span class="fn">ChatOpenAI</span>

trackly = <span class="fn">Trackly</span>()  <span class="cm"># reads TRACKLY_API_KEY</span>

llm = <span class="fn">ChatOpenAI</span>(
    model=<span class="st">"gpt-4o"</span>,
    callbacks=[trackly.callback(
        feature=<span class="st">"chat"</span>,
        user_id=user.id,
    )],
)

llm.invoke(<span class="st">"Hello!"</span>)  <span class="cm"># tracked ✓</span></div>
          </div>
        </div>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-cell">
        <span class="stat-num purple">6</span>
        <span class="stat-label">Providers</span>
      </div>
      <div class="stat-cell">
        <span class="stat-num">2</span>
        <span class="stat-label">Lines of code</span>
      </div>
      <div class="stat-cell">
        <span class="stat-num green">0ms</span>
        <span class="stat-label">Added latency</span>
      </div>
      <div class="stat-cell">
        <span class="stat-num">Free</span>
        <span class="stat-label">To start</span>
      </div>
    </div>
    <div class="cta-wrap">
      <a href="{{dashboard_url}}" class="cta-btn">
        Open your dashboard -&gt;
      </a>
      <p class="cta-hint">
        Or read the docs at
        <a href="{{docs_url}}" style="color:#a78bfa;text-decoration:none">
          {{docs_host}}
        </a>
      </p>
    </div>
  </div>
  <div class="footer">
    <div class="footer-logo">
      <span class="footer-dot"></span>
      <span class="footer-name">Trackly</span>
    </div>
    <div class="footer-links">
      <a href="{{docs_url}}">Docs</a>
      <a href="https://github.com/udaykumar-dhokia/trackly">GitHub</a>
      <a href="{{contact_url}}">Contact</a>
    </div>
    <p class="footer-copy">
      You're receiving this because you signed up at tracklyai.in<br>
      Built with &hearts; by
      <a href="https://github.com/udaykumar-dhokia">Udaykumar Dhokia</a>
      &middot; Ahmedabad, India<br>
      <a href="{{unsubscribe_url}}">Unsubscribe</a>
    </p>
  </div>
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
