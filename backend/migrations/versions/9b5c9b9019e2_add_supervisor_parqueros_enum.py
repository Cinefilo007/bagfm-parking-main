"""add supervisor_parqueros enum

Revision ID: 9b5c9b9019e2
Revises: cbd237b93c6c
Create Date: 2026-04-19 04:28:50.513983

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b5c9b9019e2'
down_revision: Union[str, None] = 'cbd237b93c6c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Añade el nuevo valor al enum rol_tipo en PostgreSQL."""
    op.execute("ALTER TYPE rol_tipo ADD VALUE IF NOT EXISTS 'SUPERVISOR_PARQUEROS'")


def downgrade() -> None:
    """Omitido por seguridad operativa en PostgreSQL."""
    pass
