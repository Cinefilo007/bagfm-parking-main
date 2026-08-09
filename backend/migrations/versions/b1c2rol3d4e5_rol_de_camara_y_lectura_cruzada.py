"""Rol de cada camara (delantera/trasera) y cruce de las dos lecturas del mismo paso

En cada alcabala hay dos camaras mirando el mismo paso: una lee la placa delantera y
otra la trasera. Un mismo vehiculo llega por tanto dos veces, y una moto —que lleva una
sola placa— llega una sola vez.

Sin el rol, "solo llego una lectura" es indistinguible de "una camara dejo de leer", que
es justo la averia que nadie nota hasta que hace falta el dato.

El enum va como VARCHAR + CHECK y no como tipo nativo, por lo mismo que el resto de los
enums nuevos del proyecto: agregar un valor a un tipo nativo obliga a un ALTER TYPE que
no corre dentro de una transaccion.

Revision ID: b1c2rol3d4e5
Revises: a7d8ide9f0a1
Create Date: 2026-08-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b1c2rol3d4e5'
down_revision: Union[str, None] = 'a7d8ide9f0a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# `create_constraint=True` es imprescindible: en SQLAlchemy 2.0 vale False por defecto,
# asi que sin el la columna queda como un VARCHAR suelto que acepta cualquier cosa
# —comprobado: admitia el rol 'lateral'— y el enum no protege nada.
CAMARA_ROL = sa.Enum(
    'delantera', 'trasera', 'unica',
    name='camara_rol', native_enum=False, create_constraint=True,
)


def upgrade() -> None:
    # Las camaras ya instaladas arrancan como 'unica': siguen comportandose igual que
    # hasta ahora hasta que alguien entre al panel y diga cual mira que extremo.
    op.add_column(
        'camaras_anpr',
        sa.Column('rol', CAMARA_ROL, nullable=False, server_default='unica'),
    )

    op.add_column('eventos_anpr', sa.Column('camara_rol', sa.String(length=20), nullable=True))
    op.add_column('eventos_anpr', sa.Column('placa_alterna', sa.String(length=20), nullable=True))
    op.add_column('eventos_anpr', sa.Column('confirmada_por_rol', sa.String(length=20), nullable=True))
    op.add_column('eventos_anpr', sa.Column('confirmada_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # El CHECK cuelga de la columna, asi que se va con ella; se nombra aqui por si
    # alguna base lo tuviera suelto de un intento anterior.
    op.execute('ALTER TABLE camaras_anpr DROP CONSTRAINT IF EXISTS camara_rol')
    op.drop_column('eventos_anpr', 'confirmada_at')
    op.drop_column('eventos_anpr', 'confirmada_por_rol')
    op.drop_column('eventos_anpr', 'placa_alterna')
    op.drop_column('eventos_anpr', 'camara_rol')
    op.drop_column('camaras_anpr', 'rol')
