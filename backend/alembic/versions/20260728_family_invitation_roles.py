"""add bidirectional family invitation roles
Revision ID: 20260728_family_invitation_roles
Revises: 20260727_join_code
"""
from alembic import op
import sqlalchemy as sa
revision = "20260728_family_invitation_roles"
down_revision = "20260727_join_code"
branch_labels = None
depends_on = None

def upgrade():
    op.alter_column("family_relationship_invitations", "caregiver_user_id", existing_type=sa.Integer(), nullable=True)
    op.add_column("family_relationship_invitations", sa.Column("inviter_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("family_relationship_invitations", sa.Column("recipient_email", sa.String(255), nullable=True))
    op.add_column("family_relationship_invitations", sa.Column("inviter_role", sa.String(20), nullable=False, server_default="caregiver"))
    op.add_column("family_relationship_invitations", sa.Column("intended_role", sa.String(20), nullable=False, server_default="learner"))
    op.execute("UPDATE family_relationship_invitations SET inviter_user_id=caregiver_user_id, recipient_email=learner_email, inviter_role='caregiver', intended_role='learner' WHERE inviter_user_id IS NULL")
    op.execute("UPDATE family_relationship_invitations SET status='expired' WHERE id IN (SELECT id FROM family_relationship_invitations WHERE status='pending' AND id NOT IN (SELECT MAX(id) FROM family_relationship_invitations WHERE status='pending' GROUP BY inviter_user_id, recipient_email, inviter_role, intended_role))")
    op.create_index("ix_family_relationship_invitations_inviter_user_id", "family_relationship_invitations", ["inviter_user_id"])
    op.create_index("ix_family_relationship_invitations_recipient_email", "family_relationship_invitations", ["recipient_email"])
    op.create_index("uq_family_invitation_pending_direction", "family_relationship_invitations", ["inviter_user_id", "recipient_email", "inviter_role", "intended_role"], unique=True, postgresql_where=sa.text("status = 'pending'"))
    op.alter_column("family_relationship_invitations", "inviter_role", server_default=None)
    op.alter_column("family_relationship_invitations", "intended_role", server_default=None)


def downgrade():
    op.execute("UPDATE family_relationship_invitations SET caregiver_user_id=accepted_by_user_id WHERE inviter_role='learner' AND status='accepted' AND accepted_by_user_id IS NOT NULL")
    op.execute("DELETE FROM family_relationship_invitations WHERE inviter_role='learner' AND caregiver_user_id IS NULL")
    op.alter_column("family_relationship_invitations", "caregiver_user_id", existing_type=sa.Integer(), nullable=False)
    op.drop_index("uq_family_invitation_pending_direction", table_name="family_relationship_invitations")
    op.drop_index("ix_family_relationship_invitations_recipient_email", table_name="family_relationship_invitations")
    op.drop_index("ix_family_relationship_invitations_inviter_user_id", table_name="family_relationship_invitations")
    op.drop_column("family_relationship_invitations", "intended_role")
    op.drop_column("family_relationship_invitations", "inviter_role")
    op.drop_column("family_relationship_invitations", "recipient_email")
    op.drop_column("family_relationship_invitations", "inviter_user_id")
