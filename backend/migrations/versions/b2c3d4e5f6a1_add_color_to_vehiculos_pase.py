"""add color to vehiculos_pase

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-04-20 02:04:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a1'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Añade la columna color a vehiculos_pase."""
    op.add_column('vehiculos_pase', sa.Column('color', sa.String(length=50), nullable=True))


def downgrade() -> None:
    """Revierte la adición de la columna color."""
    op.drop_column('vehiculos_pase', 'color')
