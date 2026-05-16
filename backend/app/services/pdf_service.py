import io
import os
import uuid
import httpx
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, LETTER
from reportlab.lib.units import mm, inch
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from app.models.alcabala_evento import LotePaseMasivo
from app.models.codigo_qr import CodigoQR
from app.models.plantilla_carnet import PlantillaCarnet
from app.models.enums import TipoCarnet
# Importamos pase_service localmente para evitar importación circular

class PDFService:
    def __init__(self):
        self.font_path = os.path.join(os.path.dirname(__file__), "Roboto-Bold.ttf")
        try:
            pdfmetrics.registerFont(TTFont('Roboto-Bold', self.font_path))
            self.font_name = 'Roboto-Bold'
        except Exception:
            self.font_name = 'Helvetica-Bold'
            print("ALERTA TÁCTICA: No se pudo cargar Roboto-Bold, usando Helvetica.")

    async def generar_pdf_lote(self, db: AsyncSession, lote_id: uuid.UUID) -> io.BytesIO:
        """
        Genera un PDF masivo con los carnets de un lote.
        Formato: 8 carnets por página (2 col x 4 filas).
        Estilo: Aegis Tactical v3.
        """
        # 1. Obtener datos
        lote = await db.get(LotePaseMasivo, lote_id)
        if not lote:
            raise ValueError("Lote no encontrado")

        query = select(CodigoQR).where(CodigoQR.lote_id == lote.id).order_by(CodigoQR.serial_legible)
        res = await db.execute(query)
        qrs = res.scalars().all()

        # 2. Cargar Plantilla
        query_t = select(PlantillaCarnet).where(PlantillaCarnet.id == lote.plantilla_carnet_id)
        res_t = await db.execute(query_t)
        plantilla = res_t.scalar_one_or_none()
        
        # Valores por defecto (Estilo AEGIST TACO)
        col_primario = HexColor(plantilla.color_primario) if plantilla else HexColor("#4EDEA3")
        col_secundario = HexColor(plantilla.color_secundario) if plantilla else HexColor("#0E1322")
        col_texto = HexColor(plantilla.color_texto) if plantilla else HexColor("#FFFFFF")
        logo_url = plantilla.logo_url if plantilla else None

        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        # Configuración de rejilla
        card_width = 90 * mm
        card_height = 65 * mm
        margin_x = (width - (2 * card_width)) / 3
        margin_y = 15 * mm
        gap_y = 5 * mm

        count = 0
        for qr_data in qrs:
            col = count % 2
            row = (count // 2) % 4
            
            if count > 0 and count % 8 == 0:
                c.showPage()
            
            x = margin_x + col * (card_width + margin_x)
            y = height - margin_y - (row + 1) * card_height - row * gap_y
            
            # --- DIBUJAR CARNET ---
            self._dibujar_carnet(c, x, y, card_width, card_height, lote, qr_data, col_primario, col_secundario, col_texto, logo_url)
            
            count += 1

        # Agregar página de instrucciones
        c.showPage()
        self._dibujar_instrucciones(c, width, height, col_secundario, col_primario)

        c.save()
        buffer.seek(0)
        return buffer

    async def generar_pdf_individual(self, pase, lote, preset, formato="colgante"):
        """
        Genera un PDF individual (tamaño carta) con un solo carnet centrado.
        """
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=LETTER)
        width, height = LETTER # 612 x 792 points (approx 215.9 x 279.4 mm)

        # Colores del preset
        cp = HexColor(preset.get('primario', '#4EDEA3'))
        cs = HexColor(preset.get('fondo', '#0E1322'))

        ct = HexColor(preset.get('textoNombre', '#FFFFFF'))
        
        # Dimensiones del carnet según formato
        dims = {
            "colgante": (100 * mm, 70 * mm),
            "credencial": (85 * mm, 55 * mm),
            "ticket": (70 * mm, 120 * mm),
            "cartera": (55 * mm, 85 * mm)
        }
        card_w, card_h = dims.get(formato, (100 * mm, 70 * mm))

        
        # Centrado
        x = (width - card_w) / 2
        y = (height - card_h) / 2

        self._dibujar_carnet(c, x, y, card_w, card_h, lote, pase, cp, cs, ct, None)

        # Instrucciones discretas abajo
        c.setFillColor(HexColor("#64748b"))
        c.setFont(self.font_name, 8)
        c.drawCentredString(width/2, y - 20 * mm, "ESTE DOCUMENTO ES UN COMPROBANTE OFICIAL DE ACCESO.")
        c.drawCentredString(width/2, y - 25 * mm, "PRESENTE EL CÓDIGO QR EN LOS PUNTOS DE CONTROL.")

        c.save()
        buffer.seek(0)
        return buffer

    def _dibujar_carnet(self, c, x, y, w, h, lote, qr, cp, cs, ct, logo_url):
        from app.services.pase_service import pase_service
        # Borde y Fondo
        c.setStrokeColor(HexColor("#334155"))
        c.setLineWidth(0.5)
        c.roundRect(x, y, w, h, 4 * mm, stroke=1, fill=0)
        
        # Header (Barra de color primario)
        header_h = 12 * mm
        c.setFillColor(cp)
        c.roundRect(x, y + h - header_h, w, header_h, 4 * mm, stroke=0, fill=1)
        # Tapar redondeado inferior del header para que sea recto
        c.rect(x, y + h - header_h, w, header_h/2, stroke=0, fill=1)
        
        # Texto Header
        c.setFillColor(cs)
        c.setFont(self.font_name, 10)
        nombre_entidad = lote.nombre_evento.upper()
        c.drawCentredString(x + w/2, y + h - 8 * mm, nombre_entidad)
        
        # QR Code
        qr_size = 35 * mm
        qr_img_buffer = pase_service.generar_qr_image(qr.token)
        from reportlab.lib.utils import ImageReader
        qr_img = ImageReader(qr_img_buffer)
        c.drawImage(qr_img, x + (w - qr_size)/2, y + 15 * mm, width=qr_size, height=qr_size)
        
        # Footer
        c.setFillColor(cs)
        c.rect(x, y, w, 12 * mm, stroke=0, fill=1)
        c.setFillColor(ct)
        c.setFont(self.font_name, 8)
        serial_text = f"SERIAL: {qr.serial_legible}"
        c.drawString(x + 5 * mm, y + 4 * mm, serial_text)
        
        acc_tipo = qr.tipo_acceso.upper() if qr.tipo_acceso else "GENERAL"
        c.drawRightString(x + w - 5 * mm, y + 4 * mm, acc_tipo)
        
        # Nombre del portador si existe
        if qr.nombre_portador:
            c.setFillColor(cs)
            c.setFont(self.font_name, 7)
            c.drawCentredString(x + w/2, y + 13 * mm, qr.nombre_portador.upper())

    def _dibujar_instrucciones(self, c, w, h, cs, cp):
        c.setFillColor(cs)
        c.rect(0, 0, w, h, stroke=0, fill=1)
        
        c.setFillColor(cp)
        c.setFont(self.font_name, 24)
        c.drawCentredString(w/2, h - 40 * mm, "INSTRUCCIONES DE ACCESO")
        
        c.setFillColor(HexColor("#FFFFFF"))
        c.setFont(self.font_name, 14)
        textos = [
            "1. Presente este carnet en la Alcabala de entrada.",
            "2. El personal de seguridad escaneará el código QR.",
            "3. Mantenga el carnet visible mientras esté en la base.",
            "4. Este pase es personal e intransferible.",
            "5. En caso de pérdida, reporte inmediatamente al Comando.",
            "",
            "BAGFM v2.0 - Sistema de Gestión de Acceso Táctico",
            "© 2026 Aegis Tactical Command"
        ]
        
        y_text = h - 70 * mm
        for linea in textos:
            c.drawCentredString(w/2, y_text, linea)
            y_text -= 15 * mm

pdf_service = PDFService()
