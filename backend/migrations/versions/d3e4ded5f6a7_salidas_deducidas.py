"""Cierra estancias que quedaron abiertas: origen_registro = 'deducido'

La camara de la puerta de salida de una alcabala apunta al FRENTE del vehiculo, y las
motos en Venezuela llevan una sola placa y va atras. Consecuencia: una moto que sale por
ahi no se detecta nunca, y sin nada mas quedaria constando dentro de la base para
siempre.

Cuando esa misma placa vuelve a entrar sin haber salido, la salida existio: solo que no
se vio. El sistema la registra con origen 'deducido' para que el listado de quien esta
dentro no se llene de vehiculos fantasma. La HORA de ese registro no es real y por eso
se marca aparte, en vez de mezclarlo con las salidas de verdad.

OJO CON LA LONGITUD DE LA COLUMNA
`origen_registro` se creo con sa.Enum('qr','anpr','manual', native_enum=False), y eso
genera un VARCHAR(6) dimensionado al valor mas largo de entonces. 'deducido' tiene 8
caracteres: sin ampliar la columna, cada intento de guardar uno reventaria con "value
too long". Se amplia a 12 para dejar sitio a lo que venga.

Revision ID: d3e4ded5f6a7
Revises: c2d3sal4e5f6
Create Date: 2026-08-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd3e4ded5f6a7'
down_revision: Union[str, None] = 'c2d3sal4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'accesos', 'origen_registro',
        existing_type=sa.String(length=6),
        type_=sa.String(length=12),
        existing_nullable=False,
        existing_server_default='qr',
    )


def downgrade() -> None:
    # Los registros deducidos no caben en VARCHAR(6). Se convierten en 'manual', que es
    # lo mas parecido que existia antes: un acceso que no vio la camara.
    op.execute("UPDATE accesos SET origen_registro = 'manual' WHERE origen_registro = 'deducido'")
    op.alter_column(
        'accesos', 'origen_registro',
        existing_type=sa.String(length=12),
        type_=sa.String(length=6),
        existing_nullable=False,
        existing_server_default='qr',
    )
