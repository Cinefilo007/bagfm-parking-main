"""Zona para socio permanente: zona_id en membresias y accesos

Revision ID: a9f1b2c3d4e5
Revises: 3383b4bbb80b
Create Date: 2026-05-04 05:03:00.000000

Permite asignar una zona específica a cada membresía de socio permanente.
Si la entidad tiene una sola zona activa, el sistema la asigna automáticamente.
También agrega zona_id a la tabla accesos para persistir el destino en el momento
del acceso (resuelve el problema del historial del parquero filtrado por zona).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9f1b2c3d4e5'
down_revision: Union[str, None] = '3383b4bbb80b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. zona_id en membresias — permite asignación específica por socio
    op.add_column('membresias',
        sa.Column('zona_id', sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        'fk_membresias_zona_id',
        'membresias', 'zonas_estacionamiento',
        ['zona_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('idx_membresias_zona_id', 'membresias', ['zona_id'])

    # 2. zona_id en accesos — persiste el destino de cada acceso de alcabala
    op.add_column('accesos',
        sa.Column('zona_id', sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        'fk_accesos_zona_id',
        'accesos', 'zonas_estacionamiento',
        ['zona_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('idx_accesos_zona_id', 'accesos', ['zona_id'])


def downgrade() -> None:
    """Downgrade schema."""
    # Revertir accesos
    op.drop_index('idx_accesos_zona_id', table_name='accesos')
    op.drop_constraint('fk_accesos_zona_id', 'accesos', type_='foreignkey')
    op.drop_column('accesos', 'zona_id')

    # Revertir membresias
    op.drop_index('idx_membresias_zona_id', table_name='membresias')
    op.drop_constraint('fk_membresias_zona_id', 'membresias', type_='foreignkey')
    op.drop_column('membresias', 'zona_id')
