"""Sync Puestos Georef

Revision ID: 46e3a9b8c2d1
Revises: 046061ebcb9a
Create Date: 2026-04-19 01:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '46e3a9b8c2d1'
down_revision: Union[str, None] = '046061ebcb9a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- ASIGNACIONES_ZONA ---
    # Renombrar capacidad_asignada a cupo_asignado si existe, o crearlo
    # Usamos una aproximación segura: intentar agregar y ver si falla (o usar SQL directo para verificar)
    # Alembic 'op.alter_column' puede funcionar si la columna existe.
    
    # Añadiendo columnas a asignaciones_zona
    # Nota: El log mostró que falló al buscar 'cupo_asignado'
    op.add_column('asignaciones_zona', sa.Column('cupo_asignado', sa.Integer(), nullable=True))
    op.add_column('asignaciones_zona', sa.Column('cupo_reservado_base', sa.Integer(), server_default='0', nullable=False))
    op.add_column('asignaciones_zona', sa.Column('notas', sa.String(length=500), nullable=True))
    op.add_column('asignaciones_zona', sa.Column('asignado_por', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_asignaciones_zona_asignado_por', 'asignaciones_zona', 'usuarios', ['asignado_por'], ['id'], ondelete='SET NULL')

    # Migrar datos si capacidad_asignada existía (opcional pero bueno para integridad)
    op.execute("UPDATE asignaciones_zona SET cupo_asignado = capacidad_asignada WHERE capacidad_asignada IS NOT NULL")
    op.alter_column('asignaciones_zona', 'cupo_asignado', nullable=False)
    op.drop_column('asignaciones_zona', 'capacidad_asignada')

    # --- PUESTOS_ESTACIONAMIENTO ---
    # Añadiendo columnas a puestos_estacionamiento
    op.add_column('puestos_estacionamiento', sa.Column('latitud', sa.String(length=50), nullable=True))
    op.add_column('puestos_estacionamiento', sa.Column('longitud', sa.String(length=50), nullable=True))
    op.add_column('puestos_estacionamiento', sa.Column('registrado_por', sa.UUID(), nullable=True))
    op.add_column('puestos_estacionamiento', sa.Column('reservado_por', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_puestos_registrado_por', 'puestos_estacionamiento', 'usuarios', ['registrado_por'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_puestos_reservado_por', 'puestos_estacionamiento', 'usuarios', ['reservado_por'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    # Revertir cambios en puestos_estacionamiento
    op.drop_constraint('fk_puestos_reservado_por', 'puestos_estacionamiento', type_='foreignkey')
    op.drop_constraint('fk_puestos_registrado_por', 'puestos_estacionamiento', type_='foreignkey')
    op.drop_column('puestos_estacionamiento', 'reservado_por')
    op.drop_column('puestos_estacionamiento', 'registrado_por')
    op.drop_column('puestos_estacionamiento', 'longitud')
    op.drop_column('puestos_estacionamiento', 'latitud')

    # Revertir cambios en asignaciones_zona
    op.add_column('asignaciones_zona', sa.Column('capacidad_asignada', sa.Integer(), nullable=True))
    op.execute("UPDATE asignaciones_zona SET capacidad_asignada = cupo_asignado")
    op.drop_constraint('fk_asignaciones_zona_asignado_por', 'asignaciones_zona', type_='foreignkey')
    op.drop_column('asignaciones_zona', 'asignado_por')
    op.drop_column('asignaciones_zona', 'notas')
    op.drop_column('asignaciones_zona', 'cupo_reservado_base')
    op.drop_column('asignaciones_zona', 'cupo_asignado')
