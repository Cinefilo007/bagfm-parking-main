"""add_qr_tipo_evento_values

Revision ID: e4f2a1c9b3d7
Revises: d8b6df35bff4
Create Date: 2026-04-14 06:00:00.000000

Extiende el enum qr_tipo en PostgreSQL para incluir los valores
requeridos por el sistema de pases masivos de eventos.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e4f2a1c9b3d7'
down_revision: Union[str, None] = 'd8b6df35bff4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Añade los nuevos valores al enum qr_tipo en PostgreSQL.
    PostgreSQL requiere ALTER TYPE ... ADD VALUE para extender enums.
    Estos valores son acumulativos y no requieren IF NOT EXISTS en versiones <9.6.
    """
    op.execute("ALTER TYPE qr_tipo ADD VALUE IF NOT EXISTS 'evento_simple'")
    op.execute("ALTER TYPE qr_tipo ADD VALUE IF NOT EXISTS 'evento_identificado'")
    op.execute("ALTER TYPE qr_tipo ADD VALUE IF NOT EXISTS 'evento_portal'")


def downgrade() -> None:
    """
    NOTA: PostgreSQL no permite eliminar valores de un enum con DROP VALUE.
    El downgrade requiere recrear el tipo desde cero, lo cual es destructivo.
    Se omite por seguridad operacional.
    """
    pass
