"""phase1 auth and byok

Revision ID: 20260220_0001
Revises:
Create Date: 2026-02-20 10:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260220_0001"
down_revision = None
branch_labels = None
depends_on = None


account_status_enum = postgresql.ENUM("active", "pending_delete", name="account_status_enum", create_type=False)
ai_provider_enum = postgresql.ENUM("anthropic", "openai", "google", name="ai_provider_enum", create_type=False)


def upgrade() -> None:
    account_status_enum.create(op.get_bind(), checkfirst=True)
    ai_provider_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("country_code", sa.String(length=2), nullable=False, server_default="ES"),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column(
            "account_status",
            account_status_enum,
            nullable=False,
            server_default="active",
        ),
        sa.Column("delete_requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scheduled_delete_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "user_ai_settings",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("monthly_limit_eur", sa.Numeric(10, 2), nullable=True),
        sa.Column("warn_percent", sa.Integer(), nullable=False, server_default="80"),
        sa.Column("hard_block_on_limit", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("chat_rate_limit_per_min", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    op.create_table(
        "api_provider_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", ai_provider_enum, nullable=False),
        sa.Column("key_ciphertext", sa.Text(), nullable=False),
        sa.Column("key_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "provider", name="uq_api_provider_keys_user_provider"),
    )
    op.create_index("ix_api_provider_keys_user_id", "api_provider_keys", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_api_provider_keys_user_id", table_name="api_provider_keys")
    op.drop_table("api_provider_keys")
    op.drop_table("user_ai_settings")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    ai_provider_enum.drop(op.get_bind(), checkfirst=True)
    account_status_enum.drop(op.get_bind(), checkfirst=True)
