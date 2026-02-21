"""phase3 offline sync chat media privacy

Revision ID: 20260221_0003
Revises: 20260220_0002
Create Date: 2026-02-21 09:30:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260221_0003"
down_revision = "20260220_0002"
branch_labels = None
depends_on = None


media_kind_enum = postgresql.ENUM(
    "diet_photo",
    "diet_label",
    "diet_menu",
    "exercise_machine_photo",
    "exercise_generated_image",
    "exercise_generated_video",
    "measurement_photo",
    name="media_kind_enum",
    create_type=False,
)
media_status_enum = postgresql.ENUM(
    "uploaded", "processing", "ready", "failed", "deleted", name="media_status_enum", create_type=False
)
chat_role_enum = postgresql.ENUM("system", "user", "assistant", name="chat_role_enum", create_type=False)
memory_domain_enum = postgresql.ENUM("global", "training", "diet", "measurements", name="memory_domain_enum", create_type=False)
job_type_enum = postgresql.ENUM(
    "diet_photo_estimation",
    "exercise_image_generation",
    "exercise_video_generation",
    "data_export",
    name="job_type_enum",
    create_type=False,
)
job_status_enum = postgresql.ENUM(
    "queued", "running", "done", "failed", "canceled", name="job_status_enum", create_type=False
)
sync_op_type_enum = postgresql.ENUM("upsert", "delete", name="sync_op_type_enum", create_type=False)
sync_status_enum = postgresql.ENUM("pending", "applied", "failed", name="sync_status_enum", create_type=False)
ai_provider_enum = postgresql.ENUM("anthropic", "openai", "google", name="ai_provider_enum", create_type=False)


def upgrade() -> None:
    media_kind_enum.create(op.get_bind(), checkfirst=True)
    media_status_enum.create(op.get_bind(), checkfirst=True)
    chat_role_enum.create(op.get_bind(), checkfirst=True)
    memory_domain_enum.create(op.get_bind(), checkfirst=True)
    job_type_enum.create(op.get_bind(), checkfirst=True)
    job_status_enum.create(op.get_bind(), checkfirst=True)
    sync_op_type_enum.create(op.get_bind(), checkfirst=True)
    sync_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "media_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", media_kind_enum, nullable=False),
        sa.Column("status", media_status_enum, nullable=False, server_default="uploaded"),
        sa.Column("storage_bucket", sa.Text(), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.Text(), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("retention_delete_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("storage_bucket", "storage_path", name="uq_media_assets_storage_path"),
    )
    op.create_index("ix_media_assets_user_kind", "media_assets", ["user_id", "kind"], unique=False)

    op.create_table(
        "chat_threads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_chat_threads_user", "chat_threads", ["user_id"], unique=False)

    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("thread_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", chat_role_enum, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("provider", ai_provider_enum, nullable=True),
        sa.Column("model", sa.Text(), nullable=True),
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("completion_tokens", sa.Integer(), nullable=True),
        sa.Column("safety_flags", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["thread_id"], ["chat_threads.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_chat_messages_thread_created",
        "chat_messages",
        ["thread_id", "created_at"],
        unique=False,
    )

    op.create_table(
        "agent_memory_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("domain", memory_domain_enum, nullable=False),
        sa.Column("memory_key", sa.Text(), nullable=False),
        sa.Column("memory_value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("source_chat_message_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_chat_message_id"], ["chat_messages.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ux_agent_memory_user_domain_key_active",
        "agent_memory_entries",
        ["user_id", "domain", "memory_key"],
        unique=True,
        postgresql_where=sa.text("deleted_at is null"),
    )

    op.create_table(
        "background_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", job_type_enum, nullable=False),
        sa.Column("status", job_status_enum, nullable=False, server_default="queued"),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("run_after", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_background_jobs_status_run_after",
        "background_jobs",
        ["status", "run_after"],
        unique=False,
    )

    op.create_table(
        "exercise_media_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("exercise_name", sa.Text(), nullable=False),
        sa.Column("machine_photo_asset_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("generated_image_asset_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("generated_video_asset_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["machine_photo_asset_id"], ["media_assets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["generated_image_asset_id"], ["media_assets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["generated_video_asset_id"], ["media_assets.id"], ondelete="SET NULL"),
    )

    op.add_column("body_measurements", sa.Column("photo_asset_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_body_measurements_photo_asset_id",
        "body_measurements",
        "media_assets",
        ["photo_asset_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "diet_item_estimates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("diet_item_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("media_asset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", ai_provider_enum, nullable=False),
        sa.Column("confidence_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column("estimate_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["diet_item_id"], ["diet_items.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["media_asset_id"], ["media_assets.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_diet_item_estimates_item", "diet_item_estimates", ["diet_item_id"], unique=False)

    op.create_table(
        "sync_operations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_id", sa.Text(), nullable=False),
        sa.Column("entity_type", sa.Text(), nullable=False),
        sa.Column("entity_id", sa.Text(), nullable=True),
        sa.Column("op_type", sync_op_type_enum, nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("client_updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("server_received_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("status", sync_status_enum, nullable=False, server_default="pending"),
        sa.Column("retries", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_sync_ops_user_status_created",
        "sync_operations",
        ["user_id", "status", "created_at"],
        unique=False,
    )

    op.create_table(
        "data_export_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="requested"),
        sa.Column("export_path", sa.Text(), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("fulfilled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("data_export_requests")

    op.drop_index("ix_sync_ops_user_status_created", table_name="sync_operations")
    op.drop_table("sync_operations")

    op.drop_index("ix_diet_item_estimates_item", table_name="diet_item_estimates")
    op.drop_table("diet_item_estimates")

    op.drop_constraint("fk_body_measurements_photo_asset_id", "body_measurements", type_="foreignkey")
    op.drop_column("body_measurements", "photo_asset_id")

    op.drop_table("exercise_media_links")

    op.drop_index("ix_background_jobs_status_run_after", table_name="background_jobs")
    op.drop_table("background_jobs")

    op.drop_index("ux_agent_memory_user_domain_key_active", table_name="agent_memory_entries")
    op.drop_table("agent_memory_entries")

    op.drop_index("ix_chat_messages_thread_created", table_name="chat_messages")
    op.drop_table("chat_messages")

    op.drop_index("ix_chat_threads_user", table_name="chat_threads")
    op.drop_table("chat_threads")

    op.drop_index("ix_media_assets_user_kind", table_name="media_assets")
    op.drop_table("media_assets")

    sync_status_enum.drop(op.get_bind(), checkfirst=True)
    sync_op_type_enum.drop(op.get_bind(), checkfirst=True)
    job_status_enum.drop(op.get_bind(), checkfirst=True)
    job_type_enum.drop(op.get_bind(), checkfirst=True)
    memory_domain_enum.drop(op.get_bind(), checkfirst=True)
    chat_role_enum.drop(op.get_bind(), checkfirst=True)
    media_status_enum.drop(op.get_bind(), checkfirst=True)
    media_kind_enum.drop(op.get_bind(), checkfirst=True)
