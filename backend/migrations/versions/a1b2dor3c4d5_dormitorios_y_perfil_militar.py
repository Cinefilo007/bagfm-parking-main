"""Dormitorios, habitaciones y perfil militar del personal

Abre el censo de alojamiento: qué dormitorios hay, con cuántas camas por habitación y
quién las ocupa. El integrante no es una tabla nueva de personas — es una fila de
`usuarios` con un perfil militar colgando, para que registrarlo aquí lo ate a los
vehículos que ya tenga a su nombre.

Ver app/models/dormitorio.py y app/models/perfil_militar.py.

Revision ID: a1b2dor3c4d5
Revises: d3e4ded5f6a7
Create Date: 2026-08-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a1b2dor3c4d5'
down_revision: Union[str, None] = 'd3e4ded5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'dormitorios',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('nombre', sa.String(length=150), nullable=False),
        sa.Column('codigo', sa.String(length=50), nullable=True),
        sa.Column('descripcion', sa.Text(), nullable=True),
        # Mismos tipos que entidades_civiles y puntos_acceso: el mapa los trata igual.
        sa.Column('latitud', sa.Numeric(10, 8), nullable=True),
        sa.Column('longitud', sa.Numeric(11, 8), nullable=True),
        sa.Column('responsable_usuario_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('creado_por', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['responsable_usuario_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['creado_por'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_dormitorios_codigo', 'dormitorios', ['codigo'], unique=True)

    op.create_table(
        'habitaciones',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('dormitorio_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('numero', sa.String(length=20), nullable=False),
        sa.Column('piso', sa.String(length=20), nullable=True),
        sa.Column('camas', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('notas', sa.Text(), nullable=True),
        # QR de la puerta. Solo el hash: mismo criterio que pantallas_monitor y cámaras.
        sa.Column('token_hash', sa.String(length=64), nullable=True),
        sa.Column('token_pista', sa.String(length=8), nullable=True),
        sa.Column('token_generado_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['dormitorio_id'], ['dormitorios.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('dormitorio_id', 'numero', name='uq_habitacion_dormitorio_numero'),
    )
    op.create_index('ix_habitaciones_dormitorio_id', 'habitaciones', ['dormitorio_id'])
    # Único: la vista pública busca la habitación por el hash del token de la URL.
    op.create_index('ix_habitaciones_token_hash', 'habitaciones', ['token_hash'], unique=True)

    op.create_table(
        'perfiles_militares',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('usuario_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('grado', sa.String(length=100), nullable=True),
        sa.Column('unidad', sa.String(length=200), nullable=True),
        sa.Column('jefe_nombre', sa.String(length=200), nullable=True),
        sa.Column('jefe_telefono', sa.String(length=50), nullable=True),
        sa.Column('tiene_vehiculo', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('habitacion_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('fecha_ingreso_dormitorio', sa.DateTime(timezone=True), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['habitacion_id'], ['habitaciones.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    # Uno a uno: una persona es una sola fila en usuarios y un solo perfil militar.
    op.create_index('ix_perfiles_militares_usuario_id', 'perfiles_militares', ['usuario_id'], unique=True)
    op.create_index('ix_perfiles_militares_habitacion_id', 'perfiles_militares', ['habitacion_id'])


def downgrade() -> None:
    op.drop_index('ix_perfiles_militares_habitacion_id', table_name='perfiles_militares')
    op.drop_index('ix_perfiles_militares_usuario_id', table_name='perfiles_militares')
    op.drop_table('perfiles_militares')

    op.drop_index('ix_habitaciones_token_hash', table_name='habitaciones')
    op.drop_index('ix_habitaciones_dormitorio_id', table_name='habitaciones')
    op.drop_table('habitaciones')

    op.drop_index('ix_dormitorios_codigo', table_name='dormitorios')
    op.drop_table('dormitorios')
