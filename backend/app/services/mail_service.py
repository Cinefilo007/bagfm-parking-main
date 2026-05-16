from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
import os
import logging
from typing import List, Dict, Any
from pathlib import Path

# Configuraciones base, idealmente de env vars
conf = ConnectionConfig(
    MAIL_USERNAME = os.getenv("MAIL_USERNAME", "no-reply@bagfm.mil.ve"),
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", ""),
    MAIL_FROM = os.getenv("MAIL_FROM", "no-reply@bagfm.mil.ve"),
    MAIL_PORT = int(os.getenv("MAIL_PORT", "587")),
    MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com"),
    MAIL_STARTTLS = True,
    MAIL_SSL_TLS = False,
    USE_CREDENTIALS = True,
    VALIDATE_CERTS = True
    # TEMPLATE_FOLDER = Path(__file__).parent.parent / "templates" / "email"
)

class MailService:
    def __init__(self):
        self.fastmail = FastMail(conf)

    async def send_simple_email(self, subject: str, body: str, to_emails: List[EmailStr]):
        message = MessageSchema(
            subject=subject,
            recipients=to_emails,
            body=body,
            subtype=MessageType.html
        )
        try:
            await self.fastmail.send_message(message)
            logging.info(f"Correo '{subject}' enviado exitosamente a {to_emails}")
        except Exception as e:
            logging.error(f"Error enviando correo: {str(e)}")

    async def send_template_email(self, subject: str, template_name: str, context: Dict[str, Any], to_emails: List[EmailStr]):
        """
        Envía un correo utilizando un template HTML jinja2.
        """
        message = MessageSchema(
            subject=subject,
            recipients=to_emails,
            template_body=context,
            subtype=MessageType.html
        )
        try:
            await self.fastmail.send_message(message, template_name=template_name)
            logging.info(f"Correo de plantilla '{template_name}' enviado a {to_emails}")
        except Exception as e:
            logging.error(f"Error enviando correo con plantilla {template_name}: {str(e)}")

mail_service = MailService()
