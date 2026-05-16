import httpx
import base64
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.alcabala_evento import LotePaseMasivo
from app.models.codigo_qr import CodigoQR
from app.services.configuracion_correo_service import configuracion_correo_service
from app.services.pdf_service import pdf_service
from app.core.config import obtener_config

config_env = obtener_config()

class CorreoMasivoService:
    async def despachar_correos_lote(
        self, 
        db: AsyncSession, 
        lote_id: UUID, 
        asunto: str, 
        cuerpo_plantilla: str, 
        adjuntar_pdf: bool,
        tipo_envio: str = "solo_qr",
        estilo_carnet: Optional[dict] = None,
        formato_carnet: Optional[str] = "colgante"
    ):
        """
        Método asíncrono que debe ser ejecutado por BackgroundTasks.
        Extrae la configuración, compila variables y envía los correos a Resend.
        """
        # Obtenemos Lote y pases
        lote = await db.get(LotePaseMasivo, lote_id)
        if not lote:
            print(f"Error: Lote {lote_id} no encontrado para despacho.")
            return

        result_pases = await db.execute(select(CodigoQR).where(CodigoQR.lote_id == lote_id))
        pases = result_pases.scalars().all()

        # Obtener Configuración
        config = None
        if lote.entidad_id:
            config = await configuracion_correo_service.obtener_por_entidad(db, lote.entidad_id)
            
        if not config:
           config = await configuracion_correo_service.obtener_general(db)
           
        api_key_to_use = config.api_key_resend if (config and config.api_key_resend) else config_env.resend_api_key

        if not api_key_to_use:
            print(f"Error: No hay Token de Resend configurado.")
            return

        remitente = config_env.mail_from
        if config and config.email_remitente:
            remitente = f"{config.nombre_remitente} <{config.email_remitente}>" if config.nombre_remitente else config.email_remitente

        # Procesar lote. Enviamos 1 a 1 mediante httpx asíncrono
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {api_key_to_use}",
                "Content-Type": "application/json"
            }
            
            for pase in pases:
                # Si ya fue enviado, saltamos (evita duplicados en reintentos masivos)
                if pase.email_enviado:
                    continue

                destinatario = pase.email_portador
                nombre_dest = pase.nombre_portador or "Usuario Invitado"
                
                if not destinatario:
                    continue

                # Compilar plantilla con diseño táctico premium
                qr_link = f"{config_env.frontend_url}/portal/pase/{pase.token}"
                
                # Botón de acción premium
                btn_style = "display: inline-block; padding: 16px 32px; background-color: #4ade80; color: #09090b; text-decoration: none; border-radius: 14px; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; border: 1px solid rgba(0,0,0,0.1); box-shadow: 0 4px 12px rgba(74, 222, 128, 0.2);"
                
                cuerpo_html = cuerpo_plantilla.replace("\n", "<br>")
                cuerpo_html = cuerpo_html.replace("{{nombre}}", f"<span style='color: #4ade80; font-weight: 900;'>{nombre_dest.upper()}</span>")
                cuerpo_html = cuerpo_html.replace("{{qr_url}}", f"<div style='text-align: center; margin: 35px 0;'><a href='{qr_link}' style='{btn_style}'>ACCEDER A MI PORTAL TÁCTICO</a></div>")

                # Contenedor profesional
                html_full = f"""
                <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #0c0f17; color: #f8fafc; padding: 40px; border-radius: 24px; max-width: 600px; margin: 20px auto; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 20px 50px rgba(0,0,0,0.3);">
                    <div style="text-align: center; margin-bottom: 40px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 20px;">
                        <div style="display: inline-block; padding: 8px 16px; background: rgba(74, 222, 128, 0.1); border-radius: 8px; margin-bottom: 15px;">
                            <span style="font-size: 11px; font-weight: 900; color: #4ade80; letter-spacing: 3px; text-transform: uppercase;">BAGFM ACCESS</span>
                        </div>
                        <h2 style="font-size: 16px; font-weight: 700; margin: 0; color: #e4e4e7; letter-spacing: 1px;">BASE AÉREA GRAL. FRANCISCO DE MIRANDA</h2>
                    </div>
                    
                    <div style="line-height: 1.8; font-size: 15px; color: #d1d5db;">
                        {cuerpo_html}
                    </div>
                    
                    <div style="margin-top: 50px; padding-top: 30px; border-top: 1px solid rgba(255,255,255,0.05); text-align: center;">
                        <p style="font-size: 10px; color: #71717a; text-transform: uppercase; letter-spacing: 2px; margin: 0;">© 2026 Comando de Base · Sistema de Gestión de Acceso Táctico</p>
                        <p style="font-size: 9px; color: #3f3f46; margin-top: 10px;">Este es un correo automático, por favor no responda a esta dirección.</p>
                    </div>
                </div>
                """

                # Generar imagen del QR para adjuntar
                from app.services.pase_service import pase_service
                qr_img_buffer = pase_service.generar_qr_image(pase.token, lote.nombre_evento, "ACCESO TÁCTICO", pase.serial_legible)
                qr_b64 = base64.b64encode(qr_img_buffer.getvalue()).decode('utf-8')

                payload = {
                    "from": remitente,
                    "to": [destinatario],
                    "subject": asunto,
                    "html": html_full,
                    "attachments": [
                        {
                            "filename": f"QR_ACCESO_{pase.serial_legible}.png",
                            "content": qr_b64
                        }
                    ]
                }

                if tipo_envio == "carnet_pdf" and estilo_carnet:
                    try:
                        pdf_buf = await pdf_service.generar_pdf_individual(pase, lote, estilo_carnet, formato_carnet)
                        pdf_b64 = base64.b64encode(pdf_buf.getvalue()).decode('utf-8')
                        payload["attachments"] = [
                            {
                                "filename": f"CARNET_ACCESO_{pase.serial_legible}.pdf",
                                "content": pdf_b64
                            }
                        ]
                    except Exception as pdf_err:
                        print(f"Error generando PDF para {destinatario}: {str(pdf_err)}")

                try:
                    response = await client.post("https://api.resend.com/emails", json=payload, headers=headers)
                    if response.status_code < 400:
                        pase.email_enviado = True
                        pase.email_ultimo_error = None
                        pase.fecha_envio_email = datetime.now()
                    else:
                        pase.email_enviado = False
                        pase.email_ultimo_error = f"Resend Error {response.status_code}: {response.text}"
                except Exception as e:
                    pase.email_enviado = False
                    pase.email_ultimo_error = str(e)
                    print(f"Exception al enviar correo a {destinatario}: {str(e)}")
            
            # Guardamos todos los estados
            await db.commit()

    async def enviar_correo_individual(
        self,
        db: AsyncSession,
        pase_id: UUID,
        asunto: str,
        cuerpo_plantilla: str,
        adjuntar_pdf: bool,
        tipo_envio: str = "solo_qr",
        estilo_carnet: Optional[dict] = None,
        formato_carnet: Optional[str] = "colgante"
    ):
        """Envía un correo a un solo pase específico."""
        pase = await db.get(CodigoQR, pase_id)
        if not pase: return
        
        lote = await db.get(LotePaseMasivo, pase.lote_id)
        if not lote: return

        # Obtener Configuración
        config = None
        if lote.entidad_id:
            config = await configuracion_correo_service.obtener_por_entidad(db, lote.entidad_id)
        if not config:
           config = await configuracion_correo_service.obtener_general(db)
           
        api_key_to_use = config.api_key_resend if (config and config.api_key_resend) else config_env.resend_api_key
        if not api_key_to_use: return

        remitente = config_env.mail_from
        if config and config.email_remitente:
            remitente = f"{config.nombre_remitente} <{config.email_remitente}>" if config.nombre_remitente else config.email_remitente
        
        destinatario = pase.email_portador
        nombre_dest = pase.nombre_portador or "Usuario Invitado"
        if not destinatario: return

        # Compilar plantilla con diseño táctico premium
        qr_link = f"{config_env.frontend_url}/portal/pase/{pase.token}"
        
        # Botón de acción premium
        btn_style = "display: inline-block; padding: 16px 32px; background-color: #4ade80; color: #09090b; text-decoration: none; border-radius: 14px; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; border: 1px solid rgba(0,0,0,0.1); box-shadow: 0 4px 12px rgba(74, 222, 128, 0.2);"
        
        cuerpo_html = cuerpo_plantilla.replace("\n", "<br>")
        cuerpo_html = cuerpo_html.replace("{{nombre}}", f"<span style='color: #4ade80; font-weight: 900;'>{nombre_dest.upper()}</span>")
        cuerpo_html = cuerpo_html.replace("{{qr_url}}", f"<div style='text-align: center; margin: 35px 0;'><a href='{qr_link}' style='{btn_style}'>ACCEDER A MI PORTAL TÁCTICO</a></div>")

        # Contenedor profesional
        html_full = f"""
        <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #0c0f17; color: #f8fafc; padding: 40px; border-radius: 24px; max-width: 600px; margin: 20px auto; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 20px 50px rgba(0,0,0,0.3);">
            <div style="text-align: center; margin-bottom: 40px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 20px;">
                <div style="display: inline-block; padding: 8px 16px; background: rgba(74, 222, 128, 0.1); border-radius: 8px; margin-bottom: 15px;">
                    <span style="font-size: 11px; font-weight: 900; color: #4ade80; letter-spacing: 3px; text-transform: uppercase;">BAGFM ACCESS</span>
                </div>
                <h2 style="font-size: 16px; font-weight: 700; margin: 0; color: #e4e4e7; letter-spacing: 1px;">BASE AÉREA GRAL. FRANCISCO DE MIRANDA</h2>
            </div>
            
            <div style="line-height: 1.8; font-size: 15px; color: #d1d5db;">
                {cuerpo_html}
            </div>
            
            <div style="margin-top: 50px; padding-top: 30px; border-top: 1px solid rgba(255,255,255,0.05); text-align: center;">
                <p style="font-size: 10px; color: #71717a; text-transform: uppercase; letter-spacing: 2px; margin: 0;">© 2026 Comando de Base · Sistema de Gestión de Acceso Táctico</p>
                <p style="font-size: 9px; color: #3f3f46; margin-top: 10px;">Este es un correo automático, por favor no responda a esta dirección.</p>
            </div>
        </div>
        """

        # Generar imagen del QR para adjuntar
        from app.services.pase_service import pase_service
        qr_img_buffer = pase_service.generar_qr_image(pase.token, lote.nombre_evento, "ACCESO TÁCTICO", pase.serial_legible)
        qr_b64 = base64.b64encode(qr_img_buffer.getvalue()).decode('utf-8')

        payload = {
            "from": remitente,
            "to": [destinatario],
            "subject": asunto,
            "html": html_full,
            "attachments": [
                {
                    "filename": f"QR_ACCESO_{pase.serial_legible}.png",
                    "content": qr_b64
                }
            ]
        }

        if tipo_envio == "carnet_pdf" and estilo_carnet:
            pdf_buf = await pdf_service.generar_pdf_individual(pase, lote, estilo_carnet, formato_carnet)
            payload["attachments"] = [{"filename": f"CARNET_{pase.serial_legible}.pdf", "content": base64.b64encode(pdf_buf.getvalue()).decode('utf-8')}]

        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {api_key_to_use}", "Content-Type": "application/json"}
            try:
                response = await client.post("https://api.resend.com/emails", json=payload, headers=headers)
                if response.status_code < 400:
                    pase.email_enviado = True
                    pase.email_ultimo_error = None
                    pase.fecha_envio_email = datetime.now()
                else:
                    pase.email_ultimo_error = response.text
                await db.commit()
            except Exception as e:
                pase.email_ultimo_error = str(e)
                await db.commit()

    async def enviar_correo_generico(
        self,
        destinatario: str,
        asunto: str,
        cuerpo_html: str
    ):
        """Envía un correo genérico (ej. bienvenida o notificación) mediante Resend."""
        if not destinatario: return
        api_key_to_use = config_env.resend_api_key
        if not api_key_to_use: 
            print("Error: No hay Token de Resend configurado globalmente.")
            return
            
        payload = {
            "from": config_env.mail_from,
            "to": [destinatario],
            "subject": asunto,
            "html": cuerpo_html
        }
        
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {api_key_to_use}", "Content-Type": "application/json"}
            try:
                response = await client.post("https://api.resend.com/emails", json=payload, headers=headers)
                if response.status_code >= 400:
                    print(f"Error Resend {response.status_code}: {response.text}")
            except Exception as e:
                print(f"Error al enviar correo genérico a {destinatario}: {str(e)}")

correo_masivo_service = CorreoMasivoService()

