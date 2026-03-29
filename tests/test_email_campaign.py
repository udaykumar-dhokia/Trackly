from app.services.email_campaign import (
    CampaignError,
    Recipient,
    build_unsubscribe_url,
    extract_placeholders,
    load_recipients,
    render_campaign,
    render_template,
)


def test_extract_placeholders_returns_unique_names():
    assert extract_placeholders("Hello {{first_name}} from {{company}} and {{first_name}}") == {
        "first_name",
        "company",
    }


def test_render_template_substitutes_values():
    rendered = render_template(
        "Hi {{first_name}}, welcome to {{company}}",
        {"first_name": "Ava", "company": "Trackly"},
    )
    assert rendered == "Hi Ava, welcome to Trackly"


def test_render_template_raises_for_missing_values():
    try:
        render_template("Hi {{first_name}}", {"email": "ava@example.com"})
    except CampaignError as exc:
        assert "first_name" in str(exc)
    else:
        raise AssertionError("Expected CampaignError")


def test_load_recipients_requires_email_column(tmp_path):
    csv_path = tmp_path / "recipients.csv"
    csv_path.write_text("name\nAva\n", encoding="utf-8")

    try:
        load_recipients(csv_path)
    except CampaignError as exc:
        assert "'email' column" in str(exc)
    else:
        raise AssertionError("Expected CampaignError")


def test_render_campaign_renders_every_recipient():
    recipients = [
        Recipient(email="ava@example.com", fields={"email": "ava@example.com", "first_name": "Ava"}),
        Recipient(email="leo@example.com", fields={"email": "leo@example.com", "first_name": "Leo"}),
    ]

    rendered = render_campaign(
        recipients,
        subject_template="Welcome {{first_name}}",
        html_template="<p>Hello {{first_name}}</p>",
        text_template="Hello {{first_name}}",
    )

    assert [item.subject for item in rendered] == ["Welcome Ava", "Welcome Leo"]
    assert [item.to_email for item in rendered] == ["ava@example.com", "leo@example.com"]


def test_render_campaign_supports_unsubscribe_placeholder(monkeypatch):
    monkeypatch.setattr("app.services.email_campaign.settings.app_base_url", "https://tracklyai.in")
    monkeypatch.setattr("app.services.email_campaign.settings.api_prefix", "/api/v1")
    monkeypatch.setattr("app.services.email_campaign.settings.resend_audience_id", "aud_123")

    recipients = [
        Recipient(
            email="ava@example.com",
            fields={
                "email": "ava@example.com",
                "first_name": "Ava",
                "unsubscribe_url": build_unsubscribe_url("contact_123"),
            },
        )
    ]

    rendered = render_campaign(
        recipients,
        subject_template="Welcome {{first_name}}",
        html_template='<a href="{{unsubscribe_url}}">Unsubscribe</a>',
        text_template="Unsubscribe: {{unsubscribe_url}}",
    )

    assert "contact_123" in rendered[0].html
    assert "aud_123" in rendered[0].text
