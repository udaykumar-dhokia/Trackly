from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse
from app.services.email import unsubscribe_contact
from app.config import settings

router = APIRouter()

@router.get("/unsubscribe", response_class=HTMLResponse)
async def unsubscribe(
    id: str = Query(..., description="The Resend contact ID"),
    audience_id: str = Query(..., description="The Resend audience ID"),
):
    success = unsubscribe_contact(audience_id, id)
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Unsubscribed | Trackly</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
            body {{
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background-color: #09090b;
                font-family: 'Inter', -apple-system, sans-serif;
                color: #a1a1aa;
            }}
            .card {{
                background: #0f0f12;
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 24px;
                padding: 48px;
                max-width: 480px;
                width: 90%;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
            }}
            .icon {{
                width: 64px;
                height: 64px;
                background: rgba(167, 139, 250, 0.1);
                border: 1px solid rgba(167, 139, 250, 0.2);
                border-radius: 16px;
                display: flex;
                justify-content: center;
                align-items: center;
                margin: 0 auto 32px;
                color: #a78bfa;
            }}
            h1 {{
                color: #f8fafc;
                font-size: 24px;
                font-weight: 800;
                margin: 0 0 16px;
                letter-spacing: -0.02em;
            }}
            p {{
                font-size: 15px;
                line-height: 1.6;
                margin: 0 0 32px;
            }}
            .btn {{
                display: inline-block;
                background: #a78bfa;
                color: #09090b;
                text-decoration: none;
                font-weight: 700;
                padding: 12px 32px;
                border-radius: 12px;
                transition: all 0.2s ease;
            }}
            .btn:hover {{
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(167, 139, 250, 0.3);
            }}
            .status-msg {{
                font-size: 13px;
                margin-top: 24px;
                color: { "#86efac" if success else "#fca5a5" };
            }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6 6 18"></path>
                    <path d="m6 6 12 12"></path>
                </svg>
            </div>
            <h1>{"Unsubscribed" if success else "Error"}</h1>
            <p>
                {"You have been successfully removed from our mailing list. We're sorry to see you go!" if success else "Something went wrong while processing your request. Please try again or contact support."}
            </p>
            <a href="{settings.app_base_url}" class="btn">Back to Trackly</a>
            {f'<div class="status-msg">Request processed successfully.</div>' if success else f'<div class="status-msg">Error: We couldn\'t find your contact information.</div>'}
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)
