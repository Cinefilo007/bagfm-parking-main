"""add vehiculo data to codigos_qr

Revision ID: a1b2c3d4e5f6
Revises: 0331f3e6c442
Create Date: 2026-04-20 05:52:00.000000

Añade uniquamente las columnas de detalle del vehículo que no fueron
incluidas en migraciones anteriores (vehiculo_marca, vehiculo_modelo,
vehiculo_color). El resto de columnas del modelo ya existen por la
migración 83d690a8b1d4.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '0331f3e6c442'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Añade columnas de detalle del vehículo a codigos_qr."""
    op.add_column('codigos_qr', sa.Column('vehiculo_marca', sa.String(length=100), nullable=True))
    op.add_column('codigos_qr', sa.Column('vehiculo_modelo', sa.String(length=100), nullable=True))
    op.add_column('codigos_qr', sa.Column('vehiculo_color', sa.String(length=50), nullable=True))


def downgrade() -> None:
    """Revierte la adición de columnas de detalle del vehículo."""
    op.drop_column('codigos_qr', 'vehiculo_color')
    op.drop_column('codigos_qr', 'vehiculo_modelo')
    op.drop_column('codigos_qr', 'vehiculo_marca')
