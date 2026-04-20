import os
import smtplib
from email.utils import getaddresses
from email.mime.text import MIMEText
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")
EMAIL_TO = os.getenv("EMAIL_TO", EMAIL_USER or "")
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "true").lower() in {"1", "true", "yes", "on"}
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "false").lower() in {"1", "true", "yes", "on"}
EMAIL_TIMEOUT_SECONDS = float(os.getenv("EMAIL_TIMEOUT_SECONDS", "20"))


def _parse_recipients(raw_recipients: str) -> list[str]:
    parsed = [address for _, address in getaddresses([raw_recipients]) if address]
    return parsed


def send_email(subject: str, body: str):
    if not EMAIL_USER or not EMAIL_PASSWORD or not EMAIL_TO:
        raise ValueError(
            f"Missing email configuration. USER={bool(EMAIL_USER)}, "
            f"PASSWORD={bool(EMAIL_PASSWORD)}, TO={bool(EMAIL_TO)}"
        )

    recipients = _parse_recipients(EMAIL_TO)
    if not recipients:
        raise ValueError("No valid recipient addresses found in EMAIL_TO")

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = EMAIL_USER
    msg["To"] = ", ".join(recipients)

    try:
        logger.info("[EMAIL] Attempting to send email from %s to %s", EMAIL_USER, recipients)
        smtp_cls = smtplib.SMTP_SSL if EMAIL_USE_SSL else smtplib.SMTP
        with smtp_cls(EMAIL_HOST, EMAIL_PORT, timeout=EMAIL_TIMEOUT_SECONDS) as server:
            if EMAIL_USE_TLS and not EMAIL_USE_SSL:
                server.starttls()
            server.login(EMAIL_USER, EMAIL_PASSWORD)
            server.send_message(msg)

        logger.info("[EMAIL] Sent successfully to %s", recipients)

    except smtplib.SMTPAuthenticationError as e:
        logger.error(
            "[EMAIL ERROR] Authentication failed. Check EMAIL_USER and EMAIL_PASSWORD: %s", e
        )
        raise
    except smtplib.SMTPException as e:
        logger.error("[EMAIL ERROR] SMTP error occurred: %s", e)
        raise
    except Exception as e:
        logger.error("[EMAIL ERROR] Unexpected error: %s", e)
        raise
