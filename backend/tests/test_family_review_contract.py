from app.models.schemas import FamilyReviewOut, FamilyReviewItemOut


def test_review_contract_preserves_annotation_counts_and_stable_ids():
    review = FamilyReviewOut(
        session_ref="fs_1", total_annotated_concerns=3,
        identified_concerns=3, unresolved_concerns=0,
        concerns=[FamilyReviewItemOut(element_key="el-1", annotation_ids=[1, 2], tactic_tag="secrecy_request", text="Keep this secret", identified=True),
                   FamilyReviewItemOut(element_key="el-2", annotation_ids=[3], tactic_tag="suspicious_link", text="Open this link", identified=True)],
    )
    assert review.total_annotated_concerns == len([1, 2, 3])
    assert review.identified_concerns == 3
    assert review.unresolved_concerns == 0
    assert review.concerns[0].annotation_ids == [1, 2]


def test_review_contract_separates_checkpoint_and_shared_discussion_channels():
    review = FamilyReviewOut(session_ref="fs_1", total_annotated_concerns=1, identified_concerns=0, unresolved_concerns=1,
        completed_checkpoints=[{"checkpoint_message_id": 7, "responder_role": "child", "text": "I would pause."}],
        shared_discussion=[{"checkpoint_message_id": 7, "responder_role": "child", "text": "I would pause."}, {"responder_role": "caregiver", "text": "Let us talk."}])
    assert len(review.completed_checkpoints) == 1
    assert len(review.shared_discussion) == 2
    assert "private_exchange" not in review.model_dump_json()
