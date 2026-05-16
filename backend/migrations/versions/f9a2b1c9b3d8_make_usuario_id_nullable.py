"""make_usuario_id_nullable

Revision ID: f9a2b1c9b3d8
Revises: e4f2a1c9b3d7
Create Date: 2026-04-14 06:11:00.000000

Cambia la columna usuario_id de codigos_qr para que sea opcional (nullable=True),
permitiendo la generación de pases masivos simples que no están vinculados
a un usuario específico al momento de su creación.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f9a2b1c9b3d8'
down_revision: Union[str, None] = 'e4f2a1c9b3d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Cambiar columna usuario_id a nullable=True
    op.alter_column('codigos_qr', 'usuario_id',
               existing_type=postgresql.UUID(),
               nullable=True)


def downgrade() -> None:
    # Revertir a nullable=False (CUIDADO: fallará si hay nulos en la DB)
    op.alter_column('codigos_qr', 'usuario_id',
               existing_type=postgresql.UUID(),
               nullable=False)
