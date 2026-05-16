import asyncio
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.core.database import FabricaSesion
from app.models.codigo_qr import CodigoQR
from app.models.acceso import Acceso
from app.models.vehiculo_pase import VehiculoPase
from app.models.usuario import Usuario

async def main():
    async with FabricaSesion() as db:
        res = await db.execute(
            select(Acceso).order_by(Acceso.timestamp.desc()).limit(10)
        )
        accesos = res.scalars().all()
        for a in accesos:
            if not a.qr_id: continue
            
            res_qr = await db.execute(select(CodigoQR).where(CodigoQR.id == a.qr_id))
            qr = res_qr.scalars().first()
            if not qr: continue
            
            res_vp = await db.execute(select(VehiculoPase).where(VehiculoPase.qr_id == qr.id))
            vps = res_vp.scalars().all()
            
            print(f"Acceso: {a.id} at {a.timestamp} (tipo: {a.tipo}) QR_ID: {qr.id}")
            print(f"  QR Placa: {qr.vehiculo_placa}")
            for vp in vps:
                print(f"  VP: {vp.id} | ingresado: {vp.ingresado} | zona: {vp.zona_asignada_id} | hora_ingreso: {vp.hora_ingreso}")
                
if __name__ == "__main__":
    asyncio.run(main())
