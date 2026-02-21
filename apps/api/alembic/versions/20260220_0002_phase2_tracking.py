"""phase2 tracking tables

Revision ID: 20260220_0002
Revises: 20260220_0001
Create Date: 2026-02-20 12:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260220_0002"
down_revision = "20260220_0001"
branch_labels = None
depends_on = None


goal_domain_enum = postgresql.ENUM("training", "diet", "body", "wellness", name="goal_domain_enum", create_type=False)
workout_session_status_enum = postgresql.ENUM(
    "in_progress", "finished", name="workout_session_status_enum", create_type=False
)
meal_type_enum = postgresql.ENUM(
    "breakfast", "lunch", "snack", "dinner", "other", name="meal_type_enum", create_type=False
)


def upgrade() -> None:
    goal_domain_enum.create(op.get_bind(), checkfirst=True)
    workout_session_status_enum.create(op.get_bind(), checkfirst=True)
    meal_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("domain", goal_domain_enum, nullable=False),
        sa.Column("target_value", sa.Numeric(12, 3), nullable=True),
        sa.Column("target_unit", sa.String(length=32), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ux_goals_single_active_per_user",
        "goals",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("is_active = true"),
    )

    op.create_table(
        "workout_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_workout_templates_user_position", "workout_templates", ["user_id", "position"], unique=False)

    op.create_table(
        "workout_template_exercises",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("workout_template_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("exercise_name_snapshot", sa.Text(), nullable=False),
        sa.Column("muscle_group_snapshot", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["workout_template_id"], ["workout_templates.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_workout_template_exercises_template_position",
        "workout_template_exercises",
        ["workout_template_id", "position"],
        unique=False,
    )

    op.create_table(
        "workout_template_sets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("template_exercise_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reps_fixed", sa.Integer(), nullable=True),
        sa.Column("reps_min", sa.Integer(), nullable=True),
        sa.Column("reps_max", sa.Integer(), nullable=True),
        sa.Column("rest_mmss", sa.String(length=5), nullable=False),
        sa.Column("weight_kg", sa.Numeric(8, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["template_exercise_id"], ["workout_template_exercises.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            "(reps_fixed IS NOT NULL AND reps_min IS NULL AND reps_max IS NULL) OR "
            "(reps_fixed IS NULL AND reps_min IS NOT NULL AND reps_max IS NOT NULL AND reps_min <= reps_max)",
            name="ck_workout_template_sets_reps_mode",
        ),
        sa.CheckConstraint("rest_mmss ~ '^[0-5][0-9]:[0-5][0-9]$'", name="ck_workout_template_sets_rest_mmss"),
    )
    op.create_index(
        "ix_workout_template_sets_exercise_position",
        "workout_template_sets",
        ["template_exercise_id", "position"],
        unique=False,
    )

    op.create_table(
        "workout_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", workout_session_status_enum, nullable=False, server_default="in_progress"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("applied_changes_to_template", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["template_id"], ["workout_templates.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_workout_sessions_user_started", "workout_sessions", ["user_id", "started_at"], unique=False)

    op.create_table(
        "workout_session_exercises",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("workout_session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_template_exercise_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("exercise_name_snapshot", sa.Text(), nullable=False),
        sa.Column("muscle_group_snapshot", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["workout_session_id"], ["workout_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_template_exercise_id"], ["workout_template_exercises.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_workout_session_exercises_session_position",
        "workout_session_exercises",
        ["workout_session_id", "position"],
        unique=False,
    )

    op.create_table(
        "workout_session_sets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("session_exercise_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_template_set_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reps_fixed", sa.Integer(), nullable=True),
        sa.Column("reps_min", sa.Integer(), nullable=True),
        sa.Column("reps_max", sa.Integer(), nullable=True),
        sa.Column("rest_mmss", sa.String(length=5), nullable=False),
        sa.Column("weight_kg", sa.Numeric(8, 2), nullable=True),
        sa.Column("inherited_from_last_session", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["session_exercise_id"], ["workout_session_exercises.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_template_set_id"], ["workout_template_sets.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "(reps_fixed IS NOT NULL AND reps_min IS NULL AND reps_max IS NULL) OR "
            "(reps_fixed IS NULL AND reps_min IS NOT NULL AND reps_max IS NOT NULL AND reps_min <= reps_max)",
            name="ck_workout_session_sets_reps_mode",
        ),
        sa.CheckConstraint("rest_mmss ~ '^[0-5][0-9]:[0-5][0-9]$'", name="ck_workout_session_sets_rest_mmss"),
    )
    op.create_index(
        "ix_workout_session_sets_exercise_position",
        "workout_session_sets",
        ["session_exercise_id", "position"],
        unique=False,
    )

    op.create_table(
        "diet_days",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("day_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "day_date", name="uq_diet_days_user_date"),
    )

    op.create_table(
        "diet_meals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("day_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("meal_type", meal_type_enum, nullable=False),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["day_id"], ["diet_days.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_diet_meals_day_position", "diet_meals", ["day_id", "position"], unique=False)

    op.create_table(
        "diet_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("meal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("grams", sa.Numeric(10, 2), nullable=True),
        sa.Column("serving_count", sa.Numeric(10, 3), nullable=True),
        sa.Column("calories_kcal", sa.Numeric(10, 2), nullable=True),
        sa.Column("protein_g", sa.Numeric(10, 2), nullable=True),
        sa.Column("carbs_g", sa.Numeric(10, 2), nullable=True),
        sa.Column("fat_g", sa.Numeric(10, 2), nullable=True),
        sa.Column("calories_protein_kcal", sa.Numeric(10, 2), nullable=True),
        sa.Column("calories_carbs_kcal", sa.Numeric(10, 2), nullable=True),
        sa.Column("calories_fat_kcal", sa.Numeric(10, 2), nullable=True),
        sa.Column("created_by_ai", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["meal_id"], ["diet_meals.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_diet_items_meal_id", "diet_items", ["meal_id"], unique=False)

    op.create_table(
        "body_measurements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("measured_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("weight_kg", sa.Numeric(8, 3), nullable=True),
        sa.Column("circumferences_cm", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_body_measurements_user_measured_at",
        "body_measurements",
        ["user_id", "measured_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_body_measurements_user_measured_at", table_name="body_measurements")
    op.drop_table("body_measurements")

    op.drop_index("ix_diet_items_meal_id", table_name="diet_items")
    op.drop_table("diet_items")

    op.drop_index("ix_diet_meals_day_position", table_name="diet_meals")
    op.drop_table("diet_meals")

    op.drop_table("diet_days")

    op.drop_index("ix_workout_session_sets_exercise_position", table_name="workout_session_sets")
    op.drop_table("workout_session_sets")

    op.drop_index("ix_workout_session_exercises_session_position", table_name="workout_session_exercises")
    op.drop_table("workout_session_exercises")

    op.drop_index("ix_workout_sessions_user_started", table_name="workout_sessions")
    op.drop_table("workout_sessions")

    op.drop_index("ix_workout_template_sets_exercise_position", table_name="workout_template_sets")
    op.drop_table("workout_template_sets")

    op.drop_index("ix_workout_template_exercises_template_position", table_name="workout_template_exercises")
    op.drop_table("workout_template_exercises")

    op.drop_index("ix_workout_templates_user_position", table_name="workout_templates")
    op.drop_table("workout_templates")

    op.drop_index("ux_goals_single_active_per_user", table_name="goals")
    op.drop_table("goals")

    meal_type_enum.drop(op.get_bind(), checkfirst=True)
    workout_session_status_enum.drop(op.get_bind(), checkfirst=True)
    goal_domain_enum.drop(op.get_bind(), checkfirst=True)
