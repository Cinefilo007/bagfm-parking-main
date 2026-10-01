"""Las lecturas de apertura y cierre se pueden corregir sin perder lo que declaro el bombero

El administrador necesita arreglar una apertura mal tecleada, pero la razon de ver la
apertura es precisamente auditar lo que pone el bombero. Sobrescribir cantidad_medida a
secas borraria la prueba: el numero corregido quedaria como si lo hubiera declarado el.

Por eso la cifra original se guarda aparte la PRIMERA vez que se corrige (las siguientes
correcciones no la tocan) junto con quien corrigio, cuando y por que.

Revision ID: c3d4cor5e6f7
Revises: b2c3dor4e5f6
Create Date: 2026-10-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'c3d4cor5e6f7'
down_revision: Union[str, None] = 'b2c3dor4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('lecturas_tanque', sa.Column('cantidad_original', sa.Float(), nullable=True))
    op.add_column('lecturas_tanque', sa.Column(
        'corregida_por_id', postgresql.UUID(as_uuid=True),
        sa.ForeignKey('usuarios.id', ondelete='RESTRICT'), nullable=True,
    ))
    op.add_column('lecturas_tanque', sa.Column('corregida_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('lecturas_tanque', sa.Column('motivo_correccion', sa.String(length=300), nullable=True))


def downgrade() -> None:
    op.drop_column('lecturas_tanque', 'motivo_correccion')
    op.drop_column('lecturas_tanque', 'corregida_at')
    op.drop_column('lecturas_tanque', 'corregida_por_id')
    op.drop_column('lecturas_tanque', 'cantidad_original')
