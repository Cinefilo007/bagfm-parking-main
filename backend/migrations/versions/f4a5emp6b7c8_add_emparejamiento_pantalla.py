"""Emparejamiento de pantallas por código (estilo Netflix)

Permite vincular un televisor a una alcabala sin teclear credenciales en él.
Ver app/models/emparejamiento_pantalla.py.

Revision ID: f4a5emp6b7c8
Revises: e3f4pan5a6b7
Create Date: 2026-08-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f4a5emp6b7c8'
down_revision: Union[str, None] = 'e3f4pan5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'emparejamientos_pantalla',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('codigo', sa.String(length=10), nullable=False),
        sa.Column('secreto_hash', sa.String(length=64), nullable=False),
        sa.Column('pantalla_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('confirmado_por', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('confirmado_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expira_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['pantalla_id'], ['pantallas_monitor.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['confirmado_por'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    # Únicos: el código lo busca el teléfono del guardia y el secreto lo busca el
    # televisor. Dos emparejamientos vivos no pueden compartir ninguno de los dos.
    op.create_index('ix_emparejamientos_pantalla_codigo', 'emparejamientos_pantalla', ['codigo'], unique=True)
    op.create_index('ix_emparejamientos_pantalla_secreto', 'emparejamientos_pantalla', ['secreto_hash'], unique=True)
    # Para la purga de los caducados.
    op.create_index('ix_emparejamientos_pantalla_expira', 'emparejamientos_pantalla', ['expira_at'])


def downgrade() -> None:
    op.drop_index('ix_emparejamientos_pantalla_expira', table_name='emparejamientos_pantalla')
    op.drop_index('ix_emparejamientos_pantalla_secreto', table_name='emparejamientos_pantalla')
    op.drop_index('ix_emparejamientos_pantalla_codigo', table_name='emparejamientos_pantalla')
    op.drop_table('emparejamientos_pantalla')
