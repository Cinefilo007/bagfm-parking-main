"""Inventario de cámaras ANPR con token de ingesta administrable

Mueve el token de ingesta de una variable de entorno global a un token por cámara,
guardado hasheado y administrable desde el panel del Comandante. Ver
app/models/camara_anpr.py para el porqué del SHA-256.

Revision ID: d2e3cam4f5a6
Revises: c1d2anpr3e4f
Create Date: 2026-08-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'd2e3cam4f5a6'
down_revision: Union[str, None] = 'c1d2anpr3e4f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'camaras_anpr',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('nombre', sa.String(length=150), nullable=False),
        sa.Column('punto_acceso_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('modelo', sa.String(length=100), nullable=True),
        sa.Column('serial', sa.String(length=100), nullable=True),
        sa.Column('ip_lan', sa.String(length=45), nullable=True),
        sa.Column('notas', sa.String(length=500), nullable=True),
        sa.Column('token_hash', sa.String(length=64), nullable=True),
        sa.Column('token_pista', sa.String(length=8), nullable=True),
        sa.Column('token_generado_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('token_generado_por', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('activa', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('ultimo_evento_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_eventos', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('creado_por', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['punto_acceso_id'], ['puntos_acceso.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['token_generado_por'], ['usuarios.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['creado_por'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    # Único: la ingesta encuentra la cámara buscando por el hash del token de la URL,
    # así que dos cámaras no pueden compartirlo.
    op.create_index('ix_camaras_anpr_token_hash', 'camaras_anpr', ['token_hash'], unique=True)
    op.create_index('ix_camaras_anpr_punto_acceso_id', 'camaras_anpr', ['punto_acceso_id'])

    op.add_column('eventos_anpr', sa.Column('camara_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_eventos_anpr_camara', 'eventos_anpr', 'camaras_anpr',
                          ['camara_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_eventos_anpr_camara_id', 'eventos_anpr', ['camara_id'])


def downgrade() -> None:
    op.drop_index('ix_eventos_anpr_camara_id', table_name='eventos_anpr')
    op.drop_constraint('fk_eventos_anpr_camara', 'eventos_anpr', type_='foreignkey')
    op.drop_column('eventos_anpr', 'camara_id')

    op.drop_index('ix_camaras_anpr_punto_acceso_id', table_name='camaras_anpr')
    op.drop_index('ix_camaras_anpr_token_hash', table_name='camaras_anpr')
    op.drop_table('camaras_anpr')
