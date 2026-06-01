"""add_supervisor_bomberos_and_daily_reads

Revision ID: f1a2b3c4d5e6
Revises: 3484dc14b07e
Create Date: 2026-06-01 10:39:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = '3484dc14b07e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Añade el rol SUPERVISOR_BOMBEROS al enum de roles.
    Añade los tipos de lectura diaria (apertura_dia, cierre_dia) al enum de lecturas de tanque.
    El valor 'inicial_semana' se conserva por compatibilidad con registros históricos.
    """
    # 1. Nuevo rol de Supervisor de Bomberos
    op.execute("ALTER TYPE rol_tipo ADD VALUE IF NOT EXISTS 'SUPERVISOR_BOMBEROS'")

    # 2. Nuevos tipos de lectura diaria de tanque
    op.execute("ALTER TYPE tipo_lectura_tanque_enum ADD VALUE IF NOT EXISTS 'apertura_dia'")
    op.execute("ALTER TYPE tipo_lectura_tanque_enum ADD VALUE IF NOT EXISTS 'cierre_dia'")


def downgrade() -> None:
    """
    Omitido por seguridad operativa en PostgreSQL.
    Los valores de enum no se eliminan para evitar errores de integridad referencial.
    """
    pass
