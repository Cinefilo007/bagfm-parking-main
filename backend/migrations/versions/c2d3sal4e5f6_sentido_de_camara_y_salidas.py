"""El sentido lo fija la puerta donde esta la camara, no el firmware

Una de las dos alcabalas tiene la puerta de entrada y la de salida separadas: ahi el
sentido lo dice el sitio donde esta atornillada la camara y no hay nada que deducir. La
otra tiene un solo carril compartido, y esas camaras quedan en `mixto`.

Hasta ahora el sentido dependia por completo de que la camara enviara `direction` con
uno de seis valores conocidos. Cuando no lo mandaba, el evento quedaba como
`desconocida` y el registro lo trataba como ENTRADA — es decir, el sistema practicamente
no registraba salidas.

`mixto` es el valor por defecto porque conserva exactamente el comportamiento anterior:
hacer caso al firmware. Las camaras de puerta unica se dejan asi y las de puerta fija se
marcan desde el panel.

Revision ID: c2d3sal4e5f6
Revises: b1c2rol3d4e5
Create Date: 2026-08-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c2d3sal4e5f6'
down_revision: Union[str, None] = 'b1c2rol3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# create_constraint=True explicito: en SQLAlchemy 2.0 vale False por defecto y sin el la
# columna acepta cualquier texto.
CAMARA_SENTIDO = sa.Enum(
    'entrada', 'salida', 'mixto',
    name='camara_sentido', native_enum=False, create_constraint=True,
)


def upgrade() -> None:
    op.add_column(
        'camaras_anpr',
        sa.Column('sentido', CAMARA_SENTIDO, nullable=False, server_default='mixto'),
    )
    op.add_column(
        'eventos_anpr',
        sa.Column('sentido_origen', sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('eventos_anpr', 'sentido_origen')
    op.execute('ALTER TABLE camaras_anpr DROP CONSTRAINT IF EXISTS camara_sentido')
    op.drop_column('camaras_anpr', 'sentido')
