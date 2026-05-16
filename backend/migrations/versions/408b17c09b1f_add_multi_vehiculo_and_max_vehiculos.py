"""add_multi_vehiculo_and_max_vehiculos

Revision ID: 408b17c09b1f
Revises: 5ef70e131056
Create Date: 2026-05-06 21:48:46.896121

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '408b17c09b1f'
down_revision: Union[str, None] = '5ef70e131056'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # LotePaseMasivo
    op.add_column('lotes_pase_masivo', sa.Column('multi_vehiculo', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('lotes_pase_masivo', sa.Column('max_vehiculos', sa.Integer(), server_default='1', nullable=False))
    # CodigoQR
    op.add_column('codigos_qr', sa.Column('max_vehiculos', sa.Integer(), server_default='1', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('codigos_qr', 'max_vehiculos')
    op.drop_column('lotes_pase_masivo', 'max_vehiculos')
    op.drop_column('lotes_pase_masivo', 'multi_vehiculo')
