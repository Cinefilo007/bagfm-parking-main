"""add portador info to codigos_qr

Revision ID: 0331f3e6c442
Revises: ab9f9d3f1952
Create Date: 2026-04-19 22:31:49.905380

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0331f3e6c442'
down_revision: Union[str, None] = 'ab9f9d3f1952'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('codigos_qr', sa.Column('email_portador', sa.String(length=200), nullable=True))
    op.add_column('codigos_qr', sa.Column('telefono_portador', sa.String(length=50), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('codigos_qr', 'telefono_portador')
    op.drop_column('codigos_qr', 'email_portador')
