"""Los destinos de la alcabala pasan a ser las entidades ya registradas

El catálogo `destinos_alcabala` duplicaba lo que ya vive en `entidades_civiles`
(Club de Pádel, Pizzería, Parque...). Dos listas de lo mismo se desincronizan: se da
de alta una entidad y su destino no aparece en la alcabala, o al revés.

Revision ID: a6b7dst8c9d0
Revises: f4a5emp6b7c8
Create Date: 2026-08-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a6b7dst8c9d0'
down_revision: Union[str, None] = 'f4a5emp6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('accesos', sa.Column('destino_entidad_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_accesos_destino_entidad', 'accesos', 'entidades_civiles',
                          ['destino_entidad_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_accesos_destino_entidad_id', 'accesos', ['destino_entidad_id'])

    # Se arrastra lo que se pueda: los destinos del catálogo que ya apuntaban a una
    # entidad conservan su significado. Los que no —el 'Otro' y las unidades militares
    # del sembrado inicial— no tienen equivalente y se pierden. Son registros de
    # prueba de los últimos días, no operación real.
    op.execute("""
        UPDATE accesos AS a
           SET destino_entidad_id = d.entidad_id
          FROM destinos_alcabala AS d
         WHERE a.destino_id = d.id
           AND d.entidad_id IS NOT NULL
    """)

    op.drop_index('ix_accesos_destino_id', table_name='accesos')
    op.drop_constraint('fk_accesos_destino', 'accesos', type_='foreignkey')
    op.drop_column('accesos', 'destino_id')

    op.drop_index('ix_destinos_alcabala_slug', table_name='destinos_alcabala')
    op.drop_table('destinos_alcabala')


def downgrade() -> None:
    raise NotImplementedError(
        "Sin vuelta atrás: el catálogo de destinos y su asociación se descartaron a "
        "propósito. Para revertir hay que restaurar una copia de seguridad."
    )
