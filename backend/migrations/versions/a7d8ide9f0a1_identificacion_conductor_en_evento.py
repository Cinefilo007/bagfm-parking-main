"""Registra en la deteccion quien identifico al conductor y cuando

La identificacion del conductor ya dejaba rastro en `vehiculos.socio_id`, pero el
vehiculo no recuerda ni cuando ni quien lo ato a una persona. Sin eso no se puede
responder la pregunta que el mando quiere hacerle al sistema: cuantos conductores
identifico ESTE guardia en SU turno.

Las tres columnas van en la deteccion porque es el unico sitio donde coinciden el
momento, la garita y el operador.

Revision ID: a7d8ide9f0a1
Revises: b8c9veh0d1e2
Create Date: 2026-08-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a7d8ide9f0a1'
down_revision: Union[str, None] = 'b8c9veh0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'eventos_anpr',
        sa.Column('conductor_identificado_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        'eventos_anpr',
        sa.Column('conductor_identificado_por', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        'eventos_anpr',
        sa.Column('conductor_usuario_id', postgresql.UUID(as_uuid=True), nullable=True),
    )

    # SET NULL y no CASCADE: si se borra la cuenta del guardia, la identificacion
    # sigue siendo un hecho ocurrido y no debe desaparecer del historico.
    op.create_foreign_key(
        'fk_eventos_anpr_conductor_identificado_por', 'eventos_anpr', 'usuarios',
        ['conductor_identificado_por'], ['id'], ondelete='SET NULL',
    )
    op.create_foreign_key(
        'fk_eventos_anpr_conductor_usuario', 'eventos_anpr', 'usuarios',
        ['conductor_usuario_id'], ['id'], ondelete='SET NULL',
    )

    # El KPI del turno filtra por operador y por fecha; ese es su indice.
    op.create_index(
        'ix_eventos_anpr_identificacion_turno', 'eventos_anpr',
        ['conductor_identificado_por', 'conductor_identificado_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_eventos_anpr_identificacion_turno', table_name='eventos_anpr')
    op.drop_constraint('fk_eventos_anpr_conductor_usuario', 'eventos_anpr', type_='foreignkey')
    op.drop_constraint('fk_eventos_anpr_conductor_identificado_por', 'eventos_anpr', type_='foreignkey')
    op.drop_column('eventos_anpr', 'conductor_usuario_id')
    op.drop_column('eventos_anpr', 'conductor_identificado_por')
    op.drop_column('eventos_anpr', 'conductor_identificado_at')
