"""Vincula codigos_qr y vehiculos_pase con el registro madre de vehiculos

La informacion de vehiculos vivia repartida en tres tablas que se copiaban la placa
entre si en vez de apuntarse. Consecuencia: la misma placa podia estar escrita de
tres formas distintas y el sistema no sabia que eran el mismo carro.

Dos pasos:
  1. Normalizar las placas ya guardadas (mayusculas, sin guiones ni espacios). Sin
     esto, la comparacion normalizada de placa_lookup tendria que quedarse para
     siempre y cada consulta nueva volveria a tropezar con lo mismo.
  2. Dejar apuntando las dos tablas de pases al registro madre. `codigos_qr` ya
     tenia la columna `vehiculo_id` pero sin poblar; `vehiculos_pase` no la tenia.

Las columnas duplicadas (vehiculo_placa, vehiculo_marca...) se conservan a
proposito: hay codigo vivo que las lee y quitarlas ahora romperia los pases. Se
retiran cuando todo consulte por `vehiculo_id`.

Revision ID: b8c9veh0d1e2
Revises: a6b7dst8c9d0
Create Date: 2026-08-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'b8c9veh0d1e2'
down_revision: Union[str, None] = 'a6b7dst8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# La normalizacion canonica, la misma que aplica placa_lookup.normalizar_placa.
_NORM = "UPPER(REPLACE(REPLACE({col}, '-', ''), ' ', ''))"


def upgrade() -> None:
    # ── 1. Normalizar las placas existentes ───────────────────────────────────
    for tabla, col in (
        ('vehiculos', 'placa'),
        ('vehiculos_pase', 'placa'),
        ('codigos_qr', 'vehiculo_placa'),
        ('accesos', 'vehiculo_placa'),
    ):
        op.execute(
            f"UPDATE {tabla} SET {col} = {_NORM.format(col=col)} "
            f"WHERE {col} IS NOT NULL AND {col} <> {_NORM.format(col=col)}"
        )

    # ── 2. vehiculos_pase: columna nueva ──────────────────────────────────────
    op.add_column('vehiculos_pase', sa.Column('vehiculo_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_vehiculos_pase_vehiculo', 'vehiculos_pase', 'vehiculos',
                          ['vehiculo_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_vehiculos_pase_vehiculo_id', 'vehiculos_pase', ['vehiculo_id'])

    # ── 3. Rellenar el vinculo por placa en ambas tablas ──────────────────────
    # Se enlaza por placa, que es lo unico que comparten hoy. Queda en nulo lo que no
    # tenga equivalente: son visitantes que nunca se dieron de alta en el registro,
    # y eso es informacion valida, no un error.
    op.execute("""
        UPDATE vehiculos_pase AS t
           SET vehiculo_id = v.id
          FROM vehiculos AS v
         WHERE t.placa IS NOT NULL AND v.placa = t.placa
    """)
    op.execute("""
        UPDATE codigos_qr AS t
           SET vehiculo_id = v.id
          FROM vehiculos AS v
         WHERE t.vehiculo_id IS NULL
           AND t.vehiculo_placa IS NOT NULL
           AND v.placa = t.vehiculo_placa
    """)


def downgrade() -> None:
    op.drop_index('ix_vehiculos_pase_vehiculo_id', table_name='vehiculos_pase')
    op.drop_constraint('fk_vehiculos_pase_vehiculo', 'vehiculos_pase', type_='foreignkey')
    op.drop_column('vehiculos_pase', 'vehiculo_id')
    # La normalizacion de placas y el relleno de codigos_qr.vehiculo_id no se
    # revierten: no se guarda el formato original y volver a meter guiones seria
    # reintroducir el problema que esta migracion viene a resolver.
