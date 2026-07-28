import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { FamilyScenarioPlayer } from "../FamilyScenarioPlayer";

const command = vi.fn();
const session = { id: "s1", public_id: "s1", state: "in_progress", state_version: 1, revealed_up_to: 0, active_checkpoint_element_key: null };
const detail = { session, participant_role: "learner", capabilities: { can_reveal_next: true, can_start: false, can_enter_completion_review: false, can_use_private_companion: true }, scene: { render_skin: "chat", elements: [], messages: [] }, progress: { content_progress: 1, content_total: 3 }, participants: [], caregiver_comments: [] };

vi.mock("react-router-dom", () => ({ useParams: () => ({ sessionId: "s1" }), useNavigate: () => vi.fn() }));
vi.mock("@/store", () => ({ useAppDispatch: () => vi.fn(), useAppSelector: (selector: () => unknown) => selector() }));
vi.mock("@/features/family/familySessionSlice", () => { const sessionSel = () => session; const capSel = () => detail.capabilities; const empty = () => []; return { familySessionHydrated: vi.fn(), familySessionReconciled: vi.fn(), checkpointResponseRecorded: vi.fn(), flagAttemptPending: vi.fn(), flagAttemptReceived: vi.fn(), targetSelected: vi.fn(), highlightedMessageToggled: vi.fn(), selectActiveCheckpoint: () => null, selectFamilyCapabilities: capSel, selectFamilyFindings: empty, selectFamilySession: sessionSel, selectFamilySessionStreamStatus: () => "connected", selectFlagAttemptPending: () => false, selectHighlightedMessageIds: empty, selectLastFlagAttempt: () => null, selectTagAssignments: () => ({}), selectVisibleFamilyMessages: empty, tagAssignmentSet: vi.fn() }; });
vi.mock("@/features/family/useFamilySessionEvents", () => ({ useFamilySessionEvents: vi.fn() }));
vi.mock("@/store/api", () => ({ safeQuestApi: { util: { upsertQueryData: vi.fn() } }, useGetFamilySessionQuery: () => ({ data: detail, isLoading: false, isError: false, refetch: vi.fn() }), useGetFamilyReviewQuery: () => ({ data: undefined, isLoading: false, isError: false }), useHeartbeatFamilySessionMutation: () => [vi.fn()], useCommandFamilySessionMutation: () => [command, { isLoading: false }], useSubmitCheckpointResponseMutation: () => [vi.fn(), { isLoading: false }], useSubmitCompanionCheckpointMutation: () => [vi.fn(), { isLoading: false }], useExplainWithCompanionMutation: () => [vi.fn(), { isLoading: false }], useSubmitFlagAttemptMutation: () => [vi.fn(), { isLoading: false }], useRequestCompanionHintMutation: () => [vi.fn()], useCreateCaregiverCommentMutation: () => [vi.fn(), { isLoading: false }] }));
vi.mock("../FamilyGameplayView", () => ({ FamilyGameplayView: (props: any) => <><button onClick={props.onToggleAutoplay}>toggle</button><button onClick={() => props.onSelectElement?.("x")}>inspect</button></> }));
vi.mock("@/components/family/CheckpointPause", () => ({ CheckpointPause: () => null }));
vi.mock("@/components/family/ConversationGuideView", () => ({ ConversationGuideView: () => null }));
vi.mock("@/components/family/HelpSeekingBeat", () => ({ HelpSeekingBeat: () => null }));

describe("FamilyScenarioPlayer autoplay", () => { beforeEach(() => { vi.useFakeTimers(); command.mockReset(); command.mockReturnValue({ unwrap: () => Promise.resolve(detail) }); }); afterEach(() => vi.useRealTimers());
 it("reveals once at slow cadence, pauses on inspection, and never enters review", async () => { render(<FamilyScenarioPlayer />); await vi.advanceTimersByTimeAsync(2600); expect(command).toHaveBeenCalledTimes(1); expect(command.mock.calls[0][0].command).toBe("reveal_next"); fireEvent.click(screen.getByText("inspect")); await vi.advanceTimersByTimeAsync(5200); expect(command).toHaveBeenCalledTimes(1); expect(command.mock.calls.some((call: any[]) => call[0].command === "enter_completion_review")).toBe(false); }); });
