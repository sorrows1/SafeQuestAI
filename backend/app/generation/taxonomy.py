"""The sole source of tactic tags used by content generation and review."""

from app.models.schemas import ScenarioCategory


TACTIC_TAGS_BY_CATEGORY: dict[ScenarioCategory, list[str]] = {
    ScenarioCategory.GROOMING: [
        "flattery_and_common_ground",
        "secrecy_request",
        "isolation_from_trusted_adults",
        "escalating_personal_questions",
        "gift_or_reward_offer",
        "urgency_or_guilt",
        "boundary_testing",
    ],
    ScenarioCategory.CYBERBULLYING: [
        "exclusion_or_pile_on",
        "impersonation",
        "public_humiliation",
        "repeated_targeting",
        "coercive_group_pressure",
    ],
    ScenarioCategory.SCAM: [
        "urgency_or_deadline_pressure",
        "urgency_pressure",
        "fake_prize_or_reward",
        "credential_or_payment_request",
        "impersonating_trusted_brand",
        "suspicious_link",
        "too_good_to_be_true_offer",
        "trade_trust_scam",
        "off_platform_payment",
        "new_account_signal",
    ],
    ScenarioCategory.IMAGE_REQUEST: [
        "direct_request",
        "escalating_pressure",
        "reciprocity_framing",
        "guilt_or_threat",
        "isolation_request",
        "trust_signal_mismatch",
    ],
    ScenarioCategory.OVERSHARING: [
        "location_disclosure",
        "school_or_routine_disclosure",
        "financial_or_family_info",
        "public_audience_mismatch",
        "routine_disclosure",
        "oversharing_prompt",
    ],
}
