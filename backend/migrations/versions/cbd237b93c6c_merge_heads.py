"""merge_heads

Revision ID: cbd237b93c6c
Revises: 46e3a9b8c2d1, e68753991495
Create Date: 2026-04-19 01:51:45.483659

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cbd237b93c6c'
down_revision: Union[str, None] = ('46e3a9b8c2d1', 'e68753991495')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
