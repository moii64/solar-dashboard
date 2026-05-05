import os
import logging
import httpx
from datetime import datetime

logger = logging.getLogger("solar-telegram")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
ENABLE_TELEGRAM_ALERTS = os.getenv("ENABLE_TELEGRAM_ALERTS", "0") == "1"

async def send_telegram_alert(message: str, level: str = "warning"):
    if not ENABLE_TELEGRAM_ALERTS or not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return

    icon = "🔴" if level == "critical" else "⚠️"
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    formatted_message = f"{icon} *SOLAR ALERT* [{timestamp}]\n\n{message}"
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": formatted_message,
        "parse_mode": "Markdown"
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=10.0)
            if response.status_code != 200:
                logger.error(f"Failed to send Telegram alert: {response.text}")
            else:
                logger.info("Telegram alert sent successfully.")
    except Exception as e:
        logger.error(f"Error sending Telegram alert: {e}")
