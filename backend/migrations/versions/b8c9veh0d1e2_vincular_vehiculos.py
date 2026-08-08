"""Vincula codigos_qr y vehiculos_pase con el registro madre de vehiculos

La informacion de vehiculos vivia repartida en tres tablas que se copiaban la placa
entre si en vez de apuntarse. Consecuencia: la misma placa podia estar escrita de
tres formas distintas y el sistema no sabia que eran el mismo carro.

Dos pasos:
  1. Normalizar las placas ya guardadas (mayusculas, sin guiones ni espacios).
  2. Dejar apuntando las dos tablas de pases al registro madre. `codigos_qr` ya
     tenia la columna `vehiculo_id` pero sin poblar; `vehiculos_pase` no la tenia.

Las columnas duplicadas (vehiculo_placa, vehiculo_marca...) se conservan a
proposito: hay codigo vivo que las lee y quitarlas ahora romperia los pases.

SOBRE LAS COLISIONES
`vehiculos.placa` tiene restriccion UNIQUE. Si la base ya contiene "AC255LB" y
"AC-255LB" como filas distintas, normalizar las dos produce un duplicado y la
migracion entera aborta — que es exactamente lo que paso en el primer intento.

Aqui se normaliza solo lo que NO colisiona: si dos filas apuntan al mismo valor
final, se normaliza una y la otra se deja como esta. Esas filas son vehiculos
duplicados de verdad y quien tiene que decidir cual sobra es una persona, no una
migracion. Mientras tanto siguen funcionando, porque placa_lookup compara tambien
en su forma normalizada.

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
    # ── 1a. Tablas sin restriccion de unicidad: normalizacion directa ─────────
    for tabla, col in (
        ('vehiculos_pase', 'placa'),
        ('codigos_qr', 'vehiculo_placa'),
        ('accesos', 'vehiculo_placa'),
    ):
        norm = _NORM.format(col=col)
        op.execute(
            f"UPDATE {tabla} SET {col} = {norm} "
            f"WHERE {col} IS NOT NULL AND {col} <> {norm}"
        )

    # ── 1b. vehiculos.placa es UNIQUE: solo lo que no choque ──────────────────
    # `orden = 1` deja pasar una sola fila por cada valor normalizado, y el NOT
    # EXISTS descarta las que chocarian con una fila que ya tiene ese valor.
    norm_v = _NORM.format(col='placa')
    op.execute(f"""
        WITH candidatas AS (
            SELECT id,
                   {norm_v} AS nueva,
                   ROW_NUMBER() OVER (
                       PARTITION BY {norm_v}
                       ORDER BY created_at NULLS LAST, id
                   ) AS orden
              FROM vehiculos
             WHERE placa IS NOT NULL
               AND placa <> {norm_v}
        )
        UPDATE vehiculos AS v
           SET placa = c.nueva
          FROM candidatas AS c
         WHERE v.id = c.id
           AND c.orden = 1
           AND NOT EXISTS (
               SELECT 1 FROM vehiculos AS o
                WHERE o.id <> v.id AND o.placa = c.nueva
           )
    """)

    # ── 2. vehiculos_pase: columna nueva ──────────────────────────────────────
    op.add_column('vehiculos_pase', sa.Column('vehiculo_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_vehiculos_pase_vehiculo', 'vehiculos_pase', 'vehiculos',
                          ['vehiculo_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_vehiculos_pase_vehiculo_id', 'vehiculos_pase', ['vehiculo_id'])

    # ── 3. Rellenar el vinculo ────────────────────────────────────────────────
    # Se compara en forma normalizada por los dos lados, para enlazar tambien las
    # filas que el paso anterior tuvo que dejar sin tocar por colision.
    for tabla, col in (('vehiculos_pase', 'placa'), ('codigos_qr', 'vehiculo_placa')):
        op.execute(f"""
            UPDATE {tabla} AS t
               SET vehiculo_id = v.id
              FROM vehiculos AS v
             WHERE t.vehiculo_id IS NULL
               AND t.{col} IS NOT NULL
               AND {_NORM.format(col='v.placa')} = {_NORM.format(col='t.' + col)}
        """)


def downgrade() -> None:
    op.drop_index('ix_vehiculos_pase_vehiculo_id', table_name='vehiculos_pase')
    op.drop_constraint('fk_vehiculos_pase_vehiculo', 'vehiculos_pase', type_='foreignkey')
    op.drop_column('vehiculos_pase', 'vehiculo_id')
    # La normalizacion de placas no se revierte: no se guarda el formato original y
    # volver a meter guiones seria reintroducir el problema que esto viene a resolver.
