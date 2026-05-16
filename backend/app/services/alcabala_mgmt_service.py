"""
Servicio de Gestión de Alcabalas y Guardias Temporales (Asíncrono).
Maneja la creación de puntos de control y usuarios con expiración automática.
"""
from datetime import datetime, timedelta, time, timezone
from uuid import UUID
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.alcabala_evento import PuntoAcceso, GuardiaTurno
from app.models.usuario import Usuario
from app.models.acceso import Acceso
from app.models.enums import RolTipo
from app.core.security import hashear_password
from app.core.password_rotativo import generar_password_diario, obtener_fecha_tactica
from sqlalchemy import func, update, delete, select, cast, Date
import secrets
import string
import re
from app.core.password_rotativo import VET, obtener_fecha_tactica

class AlcabalaService:
    def _generar_slug(self, texto: str) -> str:
        """Convierte un nombre de alcabala en un slug corto."""
        # Tomamos solo las primeras palabras o siglas si es largo
        texto = texto.lower()
        # Eliminar stop words comunes para acortar
        for sw in ['alcabala', 'punto', 'de', 'control', 'la', 'el']:
            texto = texto.replace(sw, '').strip()
        
        texto = re.sub(r'[^a-z0-9]', '', texto)
        return texto[:15] # Máximo 15 caracteres para el slug

    async def listar_puntos(self, db: AsyncSession):
        """Lista todas las alcabalas con su clave actual y el usuario asociado."""
        query = select(PuntoAcceso, Usuario).outerjoin(Usuario, PuntoAcceso.usuario_id == Usuario.id).where(PuntoAcceso.activo == True)
        result = await db.execute(query)
        rows = result.all()
        
        resultado = []
        for p, u in rows:
            p.clave_hoy = generar_password_diario(p.secret_key, p.key_salt)
            p.usuario_nombre = u.cedula if u else "s/u"
            resultado.append(p)
        return resultado

    async def obtener_punto_por_id(self, db: AsyncSession, id: UUID):
        query = select(PuntoAcceso).where(PuntoAcceso.id == id)
        result = await db.execute(query)
        punto = result.scalars().first()
        if punto:
            punto.clave_hoy = generar_password_diario(punto.secret_key, punto.key_salt)
        return punto

    async def crear_punto_acceso(self, db: AsyncSession, nombre: str, ubicacion: str = None):
        """
        Crea un punto de acceso y su usuario fijo asociado.
        """
        # 1. Generar semillas de seguridad
        secret = secrets.token_hex(16)
        salt = secrets.token_hex(8)
        
        # 2. Crear el Usuario fijo para esta alcabala con username único (CORTO)
        slug = self._generar_slug(nombre)
        base_username = f"alc.{slug}"
        username = base_username
        
        # Verificar si ya existe para evitar colisión de cédula (unique index)
        existing_user = await db.execute(select(Usuario).where(Usuario.cedula == username))
        if existing_user.scalars().first():
            username = f"{base_username}.{secrets.token_hex(2)}"

        pass_inicial = secrets.token_urlsafe(16)
        
        nuevo_usuario = Usuario(
            cedula=username,
            nombre="Guardia",
            apellido=nombre,
            rol=RolTipo.ALCABALA,
            password_hash=hashear_password(pass_inicial),
            activo=True
        )
        db.add(nuevo_usuario)
        await db.flush() 
        
        # 3. Crear el Punto de Acceso
        punto = PuntoAcceso(
            nombre=nombre, 
            ubicacion=ubicacion,
            usuario_id=nuevo_usuario.id,
            secret_key=secret,
            key_salt=salt
        )
        db.add(punto)
        await db.commit()
        await db.refresh(punto)
        
        punto.clave_hoy = generar_password_diario(secret, salt)
        punto.usuario_nombre = username
        return punto

    async def actualizar_punto_acceso(self, db: AsyncSession, id: UUID, nombre: str, ubicacion: str = None):
        punto = await self.obtener_punto_por_id(db, id)
        if not punto: return None
        
        punto.nombre = nombre
        punto.ubicacion = ubicacion
        await db.commit()
        await db.refresh(punto)
        return punto

    async def eliminar_punto_acceso(self, db: AsyncSession, id: UUID):
        """Elimina el punto y su usuario asociado."""
        punto = await self.obtener_punto_por_id(db, id)
        if not punto: return False
        
        u_id = punto.usuario_id
        await db.execute(delete(PuntoAcceso).where(PuntoAcceso.id == id))
        if u_id:
            await db.execute(update(Usuario).where(Usuario.id == u_id).values(is_deleted=True, activo=False))
            
        await db.commit()
        return True

    async def regenerar_clave_emergencia(self, db: AsyncSession, punto_id: UUID):
        """Garantiza una nueva clave tras una fuga de datos."""
        punto = await self.obtener_punto_por_id(db, punto_id)
        if not punto: return None
        
        # Cambiamos el salt para forzar una nueva clave táctica
        punto.key_salt = secrets.token_hex(8)
        await db.commit()
        await db.refresh(punto)
        return generar_password_diario(punto.secret_key, punto.key_salt)

    async def obtener_punto_de_usuario(self, db: AsyncSession, usuario_id: UUID):
        """Retorna el punto de acceso vinculado a este usuario de alcabala."""
        query = select(PuntoAcceso).where(PuntoAcceso.usuario_id == usuario_id)
        result = await db.execute(query)
        return result.scalars().first()

    async def obtener_mi_identificacion_actual(self, db: AsyncSession, usuario_id: UUID):
        """
        Retorna la guardia activa del usuario, validando que pertenezca al turno táctico actual (8:30 VET).
        """
        fecha_tactica = obtener_fecha_tactica()
        query = select(GuardiaTurno).where(
            GuardiaTurno.usuario_id == usuario_id,
            GuardiaTurno.activo == True
        ).order_by(GuardiaTurno.inicio_turno.desc())
        
        result = await db.execute(query)
        guardia = result.scalars().first()
        
        if guardia:
            # Validar si el inicio de turno corresponde a la fecha táctica actual
            # Convertimos inicio_turno a VET para comparar
            from app.core.password_rotativo import VET
            inicio_vet = guardia.inicio_turno.astimezone(VET)
            
            # Si el guardia inició en un ciclo táctico anterior, lo marcamos como inactivo
            limite = time(8, 30)
            inicio_tactico = inicio_vet.date()
            if inicio_vet.time() < limite:
                inicio_tactico = (inicio_vet - timedelta(days=1)).date()
            
            if inicio_tactico != fecha_tactica:
                guardia.activo = False
                await db.commit()
                return None
                
        return guardia

    async def identificar_guardia_entrante(self, db: AsyncSession, punto_id: UUID, usuario_id: UUID, datos: dict):
        """
        Registra quién está tomando el turno en este momento.
        """
        # Desactivar TODAS las guardias anteriores para este punto
        await db.execute(
            update(GuardiaTurno)
            .where(GuardiaTurno.punto_id == punto_id, GuardiaTurno.activo == True)
            .values(activo=False)
        )
        
        nuevo_turno = GuardiaTurno(
            punto_id=punto_id,
            usuario_id=usuario_id,
            grado=datos.get('grado'),
            nombre=datos.get('nombre'),
            apellido=datos.get('apellido'),
            telefono=datos.get('telefono'),
            unidad=datos.get('unidad'),
            key_version=secrets.token_hex(4) # Marca el inicio de este turno
        )
        db.add(nuevo_turno)
        await db.commit()
        return nuevo_turno

    async def obtener_guardia_actual(self, db: AsyncSession, punto_id: UUID):
        """Retorna el guardia físicamente presente, validando el turno táctico."""
        fecha_tactica = obtener_fecha_tactica()
        query = select(GuardiaTurno).where(
            GuardiaTurno.punto_id == punto_id, 
            GuardiaTurno.activo == True
        ).order_by(GuardiaTurno.inicio_turno.desc())
        
        result = await db.execute(query)
        guardia = result.scalars().first()
        
        if guardia:
            from app.core.password_rotativo import VET
            inicio_vet = guardia.inicio_turno.astimezone(VET)
            limite = time(8, 30)
            inicio_tactico = inicio_vet.date()
            if inicio_vet.time() < limite:
                inicio_tactico = (inicio_vet - timedelta(days=1)).date()
                
            if inicio_tactico != fecha_tactica:
                guardia.activo = False
                await db.commit()
                return None
                
        return guardia

    async def listar_personal_activo_mando(self, db: AsyncSession):
        """
        Retorna quién está físicamente en cada alcabala para el panel del Comandante.
        """
        ahora = datetime.utcnow()
        limite_24h = ahora - timedelta(hours=24)
        
        query = select(
            PuntoAcceso,
            GuardiaTurno
        ).join(
            GuardiaTurno, PuntoAcceso.id == GuardiaTurno.punto_id
        ).where(
            PuntoAcceso.activo == True,
            GuardiaTurno.activo == True,
            GuardiaTurno.inicio_turno >= limite_24h
        )
        result = await db.execute(query)
        rows = result.all()
        
        return [
            {
                "alcabala": p.nombre,
                "alcabala_id": p.id,
                "grado": g.grado,
                "nombre": f"{g.nombre} {g.apellido}",
                "telefono": g.telefono,
                "unidad": g.unidad,
                "inicio": g.inicio_turno
            }
            for p, g in rows
        ]

    async def obtener_metricas_punto(self, db: AsyncSession, punto_nombre: str, tactico: bool = True):
        """
        Calcula entradas y salidas para un punto.
        - tactico=True: Desde las 08:30 AM del ciclo actual.
        - tactico=False: Desde las 00:00 AM del día actual.
        """
        ahora_vet = datetime.now(VET)
        
        if tactico:
            fecha_t = obtener_fecha_tactica()
            # Inicio del ciclo: fecha_t a las 08:30 AM VET
            inicio_ciclo_vet = datetime.combine(fecha_t, time(8, 30)).replace(tzinfo=VET)
            inicio_utc = inicio_ciclo_vet.astimezone(timezone.utc).replace(tzinfo=None)
        else:
            # Inicio del día calendario: hoy a las 00:00 AM VET
            inicio_dia_vet = datetime.combine(ahora_vet.date(), time(0, 0)).replace(tzinfo=VET)
            inicio_utc = inicio_dia_vet.astimezone(timezone.utc).replace(tzinfo=None)

        q_ent = select(func.count(Acceso.id)).filter(
            func.trim(Acceso.punto_acceso) == punto_nombre.strip(),
            Acceso.tipo == "entrada",
            Acceso.timestamp >= inicio_utc
        )
        q_sal = select(func.count(Acceso.id)).filter(
            func.trim(Acceso.punto_acceso) == punto_nombre.strip(),
            Acceso.tipo == "salida",
            Acceso.timestamp >= inicio_utc
        )
        
        entradas = (await db.execute(q_ent)).scalar() or 0
        salidas = (await db.execute(q_sal)).scalar() or 0
        
        # Últimos 5 eventos en este rango
        query_hist = select(Acceso).filter(
            func.trim(Acceso.punto_acceso) == punto_nombre.strip(),
            Acceso.timestamp >= inicio_utc
        ).order_by(Acceso.timestamp.desc()).limit(5)
        
        result_h = await db.execute(query_hist)
        historial = result_h.scalars().all()
        
        eventos_formateados = []
        for h in historial:
            # Rehidratar datos básicos para el dashboard
            u_h = await db.get(Usuario, h.usuario_id) if h.usuario_id else None
            
            socio_nombre = "Socio Desconocido"
            vehiculo_str = "PEATÓN"
            
            if u_h:
                socio_nombre = f"{u_h.nombre} {u_h.apellido}"
            elif h.qr_id:
                from app.models.codigo_qr import CodigoQR
                qr_db = await db.get(CodigoQR, h.qr_id)
                if qr_db and qr_db.nombre_portador:
                    socio_nombre = f"{qr_db.nombre_portador} (PASE)"
            
            if h.vehiculo_id:
                from app.models.vehiculo import Vehiculo
                veh_h = await db.get(Vehiculo, h.vehiculo_id)
                if veh_h:
                    vehiculo_str = f"{veh_h.marca} {veh_h.modelo} [{veh_h.placa}]"
            elif h.vehiculo_pase_id:
                from app.models.vehiculo_pase import VehiculoPase
                vp = await db.get(VehiculoPase, h.vehiculo_pase_id)
                if vp:
                    vehiculo_str = f"{vp.marca} {vp.modelo} [{vp.placa}]".strip()
            elif h.qr_id and 'qr_db' in locals() and qr_db and qr_db.vehiculo_placa:
                 vehiculo_str = f"{qr_db.vehiculo_marca or ''} {qr_db.vehiculo_modelo or ''} [{qr_db.vehiculo_placa}]".strip()
            
            eventos_formateados.append({
                "id": str(h.id),
                "tipo": h.tipo,
                "timestamp": h.timestamp.isoformat(),
                "socio_nombre": socio_nombre,
                "vehiculo": vehiculo_str
            })

        return {
            "entradas": entradas,
            "salidas": salidas,
            "eventos_recientes": eventos_formateados
        }

alcabala_service = AlcabalaService()
