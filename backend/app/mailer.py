from email.message import EmailMessage
import smtplib
from pathlib import Path
from datetime import datetime

from app.config import settings


def send_password_reminder(to_email: str, usr_codusr: str, usr_name: str, password: str) -> None:
    subject = "EXI · Recordatorio de contraseña"
    body = (
        f"Hola {usr_name},\n\n"
        f"Has solicitado recuperar tu contraseña de EXI.\n\n"
        f"Usuario: {usr_codusr}\n"
        f"Contraseña: {password}\n\n"
        f"Si no has sido tú, ignora este mensaje.\n\n"
        f"— Sistema EXI\n"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user or "noreply@exi.local"
    msg["To"] = to_email
    msg.set_content(body)

    if not settings.smtp_host:
        # Modo local sin SMTP: guarda el correo en outbox para poder verificarlo
        outbox = Path(__file__).resolve().parents[1] / "outbox"
        outbox.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = outbox / f"password_{usr_codusr}_{stamp}.txt"
        file_path.write_text(
            f"To: {to_email}\nFrom: {msg['From']}\nSubject: {subject}\n\n{body}",
            encoding="utf-8",
        )
        print(f"[EXI mail] SMTP no configurado. Correo guardado en: {file_path}")
        return

    if settings.smtp_ssl:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20) as server:
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
            if settings.smtp_tls:
                server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
