"""Pantallas de garita con token de solo lectura

Evita dejar la sesión de un guardia abierta indefinidamente en el TV de la alcabala.
Ver app/models/pantalla_monitor.py.

Revision ID: e3f4pan5a6b7
Revises: d2e3cam4f5a6
Create Date: 2026-08-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'e3f4pan5a6b7'
down_revision: Union[str, None] = 'd2e3cam4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'pantallas_monitor',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('nombre', sa.String(length=150), nullable=False),
        sa.Column('punto_acceso_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('notas', sa.String(length=500), nullable=True),
        sa.Column('token_hash', sa.String(length=64), nullable=True),
        sa.Column('token_pista', sa.String(length=8), nullable=True),
        sa.Column('token_generado_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('activa', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('ultimo_acceso_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('creado_por', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['punto_acceso_id'], ['puntos_acceso.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['creado_por'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    # Único: la autenticación busca la pantalla por el hash del token que llega.
    op.create_index('ix_pantallas_monitor_token_hash', 'pantallas_monitor', ['token_hash'], unique=True)
    op.create_index('ix_pantallas_monitor_punto_acceso_id', 'pantallas_monitor', ['punto_acceso_id'])


def downgrade() -> None:
    op.drop_index('ix_pantallas_monitor_punto_acceso_id', table_name='pantallas_monitor')
    op.drop_index('ix_pantallas_monitor_token_hash', table_name='pantallas_monitor')
    op.drop_table('pantallas_monitor')
