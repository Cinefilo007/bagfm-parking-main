"""El QR de la puerta deja de ser de un solo uso

Antes la habitacion guardaba solo el hash del token: seguia el patron de las camaras y
las pantallas, donde el secreto se ensena una vez y no se puede volver a consultar. Para
un adhesivo pegado en una puerta eso resulto impracticable — cada vez que alguien abria
el panel a mirar el QR, el impreso quedaba invalidado y habia que ir a cambiarlo.

Ahora el token se guarda tambien en claro para poder reimprimir el mismo QR tantas veces
como haga falta, y regenerarlo es un acto explicito. El hash se conserva porque la vista
publica sigue buscando por el, y porque es lo que permite tener el indice unico.

Es un cambio de criterio consciente: quien pueda leer la base puede abrir la ficha
publica de cualquier habitacion. Se acepta porque esa ficha ya es publica por diseno —
cualquiera que pase por el pasillo la abre con el telefono— y el riesgo real no era el
volcado de la base sino el QR que dejaba de funcionar sin que nadie se enterase.

Revision ID: b2c3dor4e5f6
Revises: a1b2dor3c4d5
Create Date: 2026-08-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b2c3dor4e5f6'
down_revision: Union[str, None] = 'a1b2dor3c4d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('habitaciones', sa.Column('token', sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column('habitaciones', 'token')
