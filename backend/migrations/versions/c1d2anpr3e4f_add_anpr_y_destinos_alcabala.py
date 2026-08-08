"""ANPR en alcabalas: eventos_anpr, destinos_alcabala y origen de registro en accesos

Fase 1 del control de acceso vehicular de La Carlota. Ver el plan en
docs/DIRECTIVA_ALCABALAS.md y el modelo en app/models/evento_anpr.py.

Los enums nuevos se crean como VARCHAR + CHECK (`native_enum=False`) en vez de tipos
ENUM nativos de Postgres. Agregar un valor a un tipo nativo obliga a un ALTER TYPE que
no corre dentro de una transacción y que en este proyecto ya obligó a scripts de
reparación manuales; con un CHECK, agregar un estado es una migración normal.

Revision ID: c1d2anpr3e4f
Revises: f1a2b3c4d5e6
Create Date: 2026-08-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'c1d2anpr3e4f'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ORIGEN_REGISTRO = sa.Enum('qr', 'anpr', 'manual', name='origen_registro', native_enum=False)
ANPR_DIRECCION = sa.Enum('entrada', 'salida', 'desconocida', name='anpr_direccion', native_enum=False)
ANPR_ESTADO = sa.Enum('pendiente', 'resuelto', 'descartado', 'duplicado', name='anpr_estado', native_enum=False)


def upgrade() -> None:
    # ── Catálogo de destinos ──────────────────────────────────────────────────
    op.create_table(
        'destinos_alcabala',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('nombre', sa.String(length=100), nullable=False),
        sa.Column('slug', sa.String(length=50), nullable=False),
        sa.Column('entidad_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('orden', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('icono', sa.String(length=50), nullable=True),
        sa.Column('requiere_texto_libre', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['entidad_id'], ['entidades_civiles.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_destinos_alcabala_slug', 'destinos_alcabala', ['slug'], unique=True)

    # ── Bitácora cruda de detecciones de la cámara ────────────────────────────
    op.create_table(
        'eventos_anpr',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('punto_acceso_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('camara_serial', sa.String(length=100), nullable=True),
        sa.Column('canal', sa.Integer(), nullable=True),
        sa.Column('placa', sa.String(length=20), nullable=False),
        sa.Column('placa_confianza', sa.Integer(), nullable=True),
        sa.Column('pais_placa', sa.String(length=50), nullable=True),
        sa.Column('direccion', ANPR_DIRECCION, nullable=False, server_default='desconocida'),
        sa.Column('tipo_vehiculo', sa.String(length=50), nullable=True),
        sa.Column('color_vehiculo', sa.String(length=50), nullable=True),
        sa.Column('marca_vehiculo', sa.String(length=50), nullable=True),
        sa.Column('foto_placa_path', sa.Text(), nullable=True),
        sa.Column('foto_escena_path', sa.Text(), nullable=True),
        sa.Column('timestamp_camara', sa.DateTime(timezone=True), nullable=True),
        sa.Column('timestamp_recibido', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('coincidencia', sa.String(length=30), nullable=True),
        sa.Column('estado', ANPR_ESTADO, nullable=False, server_default='pendiente'),
        sa.Column('acceso_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('resuelto_por', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('resuelto_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('payload_raw', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['punto_acceso_id'], ['puntos_acceso.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['acceso_id'], ['accesos.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['resuelto_por'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_eventos_anpr_punto_acceso_id', 'eventos_anpr', ['punto_acceso_id'])
    op.create_index('ix_eventos_anpr_placa', 'eventos_anpr', ['placa'])
    op.create_index('ix_eventos_anpr_timestamp_camara', 'eventos_anpr', ['timestamp_camara'])
    op.create_index('ix_eventos_anpr_timestamp_recibido', 'eventos_anpr', ['timestamp_recibido'])
    op.create_index('ix_eventos_anpr_coincidencia', 'eventos_anpr', ['coincidencia'])
    op.create_index('ix_eventos_anpr_estado', 'eventos_anpr', ['estado'])
    op.create_index('ix_eventos_anpr_acceso_id', 'eventos_anpr', ['acceso_id'])
    # Cola del guardia: pendientes de un punto, más recientes primero.
    op.create_index('ix_eventos_anpr_punto_estado_ts', 'eventos_anpr',
                    ['punto_acceso_id', 'estado', 'timestamp_recibido'])
    # Dedupe de detecciones repetidas y análisis de recurrencia por placa.
    op.create_index('ix_eventos_anpr_placa_ts', 'eventos_anpr', ['placa', 'timestamp_recibido'])

    # ── Accesos: origen y destino declarado ───────────────────────────────────
    # Las filas existentes son todas del flujo de QR, que es el único que había.
    op.add_column('accesos', sa.Column('origen_registro', ORIGEN_REGISTRO,
                                       nullable=False, server_default='qr'))
    op.add_column('accesos', sa.Column('destino_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_accesos_destino', 'accesos', 'destinos_alcabala',
                          ['destino_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_accesos_origen_registro', 'accesos', ['origen_registro'])
    op.create_index('ix_accesos_destino_id', 'accesos', ['destino_id'])

    # ── Catálogo inicial ──────────────────────────────────────────────────────
    # Arranca con las entidades que ya operan dentro de la base. El Comandante lo
    # ajusta después; 'otro' es el único con texto libre y va de último a propósito
    # para que no se convierta en el botón por defecto.
    #
    # Los UUID van fijos y no con gen_random_uuid(): esa función solo viene de fábrica
    # desde PostgreSQL 13, y además así los mismos destinos tienen el mismo id en
    # desarrollo y en producción, lo que hace comparables los datos entre ambos.
    op.bulk_insert(
        sa.table(
            'destinos_alcabala',
            sa.column('id', postgresql.UUID(as_uuid=False)),
            sa.column('nombre', sa.String),
            sa.column('slug', sa.String),
            sa.column('orden', sa.Integer),
            sa.column('icono', sa.String),
            sa.column('requiere_texto_libre', sa.Boolean),
            sa.column('activo', sa.Boolean),
        ),
        [
            {'id': 'da734786-e2a7-4959-8783-d6475afd7191', 'nombre': 'Club de Pádel',   'slug': 'club-padel',     'orden': 10, 'icono': 'padel',   'requiere_texto_libre': False, 'activo': True},
            {'id': '86a446a0-9132-4e24-9519-5734bacae146', 'nombre': 'Club de Fútbol',  'slug': 'club-futbol',    'orden': 20, 'icono': 'futbol',  'requiere_texto_libre': False, 'activo': True},
            {'id': 'd831a2d2-82f3-4df1-8ee1-a99c1ca68eb1', 'nombre': 'Pizzería',        'slug': 'pizzeria',       'orden': 30, 'icono': 'pizza',   'requiere_texto_libre': False, 'activo': True},
            {'id': 'adb25560-921f-4769-b750-794d0ad99b9f', 'nombre': 'Parque',          'slug': 'parque',         'orden': 40, 'icono': 'parque',  'requiere_texto_libre': False, 'activo': True},
            {'id': '0bce314a-4374-4494-99fe-6ef747be70f2', 'nombre': 'Unidad Militar',  'slug': 'unidad-militar', 'orden': 50, 'icono': 'militar', 'requiere_texto_libre': False, 'activo': True},
            {'id': 'b22c188a-84d1-4ba7-9ec0-89342ab3f345', 'nombre': 'Trámite/Oficina', 'slug': 'tramite',        'orden': 60, 'icono': 'oficina', 'requiere_texto_libre': False, 'activo': True},
            {'id': '2737a4e5-8f02-41eb-97c4-188fc0af0b4b', 'nombre': 'Otro',            'slug': 'otro',           'orden': 99, 'icono': 'otro',    'requiere_texto_libre': True,  'activo': True},
        ],
    )


def downgrade() -> None:
    op.drop_index('ix_accesos_destino_id', table_name='accesos')
    op.drop_index('ix_accesos_origen_registro', table_name='accesos')
    op.drop_constraint('fk_accesos_destino', 'accesos', type_='foreignkey')
    op.drop_column('accesos', 'destino_id')
    op.drop_column('accesos', 'origen_registro')

    op.drop_table('eventos_anpr')
    op.drop_index('ix_destinos_alcabala_slug', table_name='destinos_alcabala')
    op.drop_table('destinos_alcabala')
