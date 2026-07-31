import { useState, type ReactNode, type RefObject, type UIEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Drawer,
  Fab,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CloseIcon from '@mui/icons-material/Close';
import { SkinRouter } from '@/components/scenario-render/SkinRouter';
import { SceneArtifactPanel, panelTargetFor } from '@/components/scenario-render/SceneArtifactPanel';
import type { ScenePanelNavigation } from '@/components/scenario-render/types';
import type { ClaimType, CompanionNotice } from '@/components/family/FlagInspectorRail';
import type {
  CheckpointResponse,
  ConversationGuide,
  FamilyReview,
  FamilyCaregiverComment,
  FamilyMessage,
  FamilyScene,
  FamilySessionParticipant,
  FlagAttempt,
  RenderSkin,
  ValidatedFinding,
} from '@/types';
import { GameplayMissionBar } from '@/components/family/GameplayMissionBar';
import { FlagInspectorRail, ScenarioDescriptionCard } from '@/components/family/FlagInspectorRail';
import { InstructionsGuideModal } from '@/components/family/InstructionsGuideModal';
import { CompletionReviewModal } from '@/components/family/CompletionReviewModal';
import { PresenceAvatarBar } from '@/components/family/PresenceAvatarBar';
import { CaregiverCommentSection } from '@/components/family/CaregiverCommentSection';

export interface FamilyGameplayViewProps {
  detectiveMode?: boolean;
  renderSkin: RenderSkin;
  scene?: FamilyScene;
  messages: FamilyMessage[];
  highlightedMessageIds: number[];
  selectedElementKeys?: string[];
  onSelectElement?: (elementKey: string) => void;
  /** Display-only panel state owned by the session controller. */
  panelNavigation?: ScenePanelNavigation;
  tagAssignments?: Record<number, string>;
  onToggleMessage: (messageId: number) => void;
  onSceneScroll: (event: UIEvent<HTMLDivElement>) => void;
  sceneRef: RefObject<HTMLDivElement | null>;
  showNewContent: boolean;
  onJumpToNewest: () => void;
  checkpoint?: ReactNode;
  companion?: ReactNode;
  children?: ReactNode;
  joinCode?: string | null;

  // Mission bar & Inspector shell metadata
  title?: string;
  category?: string;
  state?: string;
  revealedCount?: number;
  totalCount?: number;
  hintMessage?: string | null;
  infoGuideOpen?: boolean;
  onInfoGuideOpen?: () => void;
  onInfoGuideClose?: () => void;
  scenarioDescription?: string;
  hintLevel?: number;
  onHint?: () => void;
  onReset?: () => void;
  isResetting?: boolean;
  autoplay?: boolean;
  autoplaySpeed?: 'slow' | 'normal' | 'fast';
  onToggleAutoplay?: () => void;
  onAutoplaySpeedChange?: (speed: 'slow' | 'normal' | 'fast') => void;
  // Progression controls — explicitly require user interaction
  canRevealNext?: boolean;
  canEnterReview?: boolean;
  onRevealNext?: () => void;
  onEnterReview?: () => void;
  validatedFindingCount?: number;
  requiredFindingCount?: number;

  // Companion, Attempt & Finding props
  selectedElementKey?: string | null;
  companionNotice?: CompanionNotice | null;
  onAskCompanion?: (text: string) => Promise<void>;
  onSubmitAttempt?: (args: { element_key: string; claim: ClaimType; reasoning: string }) => Promise<void>;
  pendingAttempt?: boolean;
  lastAttempt?: FlagAttempt | null;
  validatedFindings?: ValidatedFinding[];
  isExplaining?: boolean;

  // Completion review modal props
  completionModalOpen?: boolean;
  completionAcknowledged?: boolean;
  commandLoading?: boolean;
  actionError?: string | null;
  onAcknowledgeCompletion?: () => void;
  onOpenHelp?: () => void;
  onFinishCompletion?: () => void;
  onRetryAction?: () => void;

  // Presence & Multiplayer props
  participants?: FamilySessionParticipant[];
  streamStatus?: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';
  turnRole?: 'learner' | 'caregiver' | 'shared';
  userRole?: 'learner' | 'caregiver';
  onReconnectStream?: () => void;
  onContinueAsync?: () => void;
  onEndTogetherLater?: () => void;

  // Caregiver comments props
  caregiverComments?: FamilyCaregiverComment[];
  canAddComment?: boolean;
  onSubmitComment?: (text: string, elementKey?: string | null) => Promise<void>;
  isSubmittingComment?: boolean;

  // Post-session review props
  checkpointResponses?: CheckpointResponse[];
  conversationGuide?: ConversationGuide | null;
  review?: FamilyReview | null;
  reviewLoading?: boolean;
  reviewError?: boolean;
}

/** Presentational game shell for SafeQuest Family Scenario Player. */
export function FamilyGameplayView({
  renderSkin,
  scene,
  messages,
  highlightedMessageIds,
  selectedElementKeys = [],
  onSelectElement = () => {},
  panelNavigation,
  tagAssignments = {},
  onToggleMessage,
  onSceneScroll,
  sceneRef,
  showNewContent,
  onJumpToNewest,
  checkpoint,
  companion,
  children,
  joinCode,

  title = 'Family Safety Scenario',
  category,
  state = 'active',
  revealedCount = messages.length,
  totalCount = messages.length,
  hintMessage = null,
  infoGuideOpen,
  onInfoGuideOpen,
  onInfoGuideClose,
  scenarioDescription,
  hintLevel = 0,
  onHint,
  onReset,
  isResetting = false,
  autoplay = false,
  autoplaySpeed = 'slow',
  onToggleAutoplay,
  onAutoplaySpeedChange,
  canRevealNext = false,
  canEnterReview = false,
  onRevealNext,
  onEnterReview,
  validatedFindingCount = 0,
  requiredFindingCount = 0,

  selectedElementKey = null,
  companionNotice = null,
  onAskCompanion,
  onSubmitAttempt,
  pendingAttempt = false,
  lastAttempt = null,
  validatedFindings = [],
  isExplaining = false,

  completionModalOpen = false,
  completionAcknowledged = false,
  commandLoading = false,
  actionError = null,
  onAcknowledgeCompletion,
  onOpenHelp,
  onFinishCompletion,
  onRetryAction,

  participants = [],
  streamStatus = 'connected',
  turnRole = 'learner',
  userRole = 'learner',
  onReconnectStream,
  onContinueAsync,
  onEndTogetherLater,

  caregiverComments = [],
  canAddComment = false,
  onSubmitComment,
  isSubmittingComment = false,

  checkpointResponses = [],
  conversationGuide = null,
  review = null,
  reviewLoading = false,
  reviewError = false,
}: FamilyGameplayViewProps) {
  const semanticScene: FamilyScene = scene ?? {
    scene_schema_version: 1, skin_version: "1.0", render_skin: renderSkin, elements: messages.map((message) => ({ element_key: "legacy-" + message.id, element_type: "message", parent_element_key: null, source_message_id: message.id, sequence: message.sequence, content: message.content, presentation: {}, selectable: true, accessible_label: "Message from " + message.speaker_label, semantic_role: "article" })), messages,
  };
  const [internalGuideOpen, setInternalGuideOpen] = useState(false);
  const guideOpen = infoGuideOpen ?? internalGuideOpen;
  const openGuide = () => { setInternalGuideOpen(true); onInfoGuideOpen?.(); };
  const closeGuide = () => { setInternalGuideOpen(false); onInfoGuideClose?.(); };
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [reviewSceneDismissed, setReviewSceneDismissed] = useState(false);

  const highlightedMessages = messages.filter((m) => highlightedMessageIds.includes(m.id));

  const handleToggleMessageInternal = (messageId: number) => {
    setSelectedMessageId(messageId);
    onToggleMessage(messageId);
  };

  const handleSelectMessageInternal = (id: number | null) => {
    setSelectedMessageId(id);
  };

  const handleAskCompanionInternal = async (text: string) => {
    if (onAskCompanion) {
      await onAskCompanion(text);
    }
  };

  const isCompletionReviewState = state === 'completion_review';
  const showReviewModal = (completionModalOpen || isCompletionReviewState) && !reviewSceneDismissed;

  const effectiveSelectionKeys =
    selectedElementKeys.length > 0
      ? selectedElementKeys
      : highlightedMessageIds.map((id) => "legacy-" + id);

  const completedElementKeys = validatedFindings.flatMap((finding) =>
    finding.element_keys?.length ? finding.element_keys : [finding.element_key],
  );

  const handleSelectElementInternal = (elementKey: string) => {
    onSelectElement(elementKey);
    const panelTarget = panelTargetFor(semanticScene, elementKey);
    if (panelTarget) panelNavigation?.openPanel(panelTarget);
    if (elementKey.startsWith("legacy-")) {
      const msgId = parseInt(elementKey.replace("legacy-", ""), 10);
      if (!isNaN(msgId)) {
        setSelectedMessageId(msgId);
        onToggleMessage(msgId);
      }
    } else {
      // For non-legacy element keys, resolve the source message if any.
      const sourceMsg = semanticScene.elements.find((el) => el.element_key === elementKey)?.source_message_id;
      if (sourceMsg != null) {
        setSelectedMessageId(sourceMsg);
      }
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 1, sm: 2 }, px: { xs: 1, sm: 2.5 }, height: { xs: 'calc(100dvh - 60px)', md: 'calc(100dvh - 68px)' }, overflow: 'hidden', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 1. Top Mission Bar */}
      <GameplayMissionBar
        title={title}
        category={category}
        renderSkin={renderSkin}
        state={state}
        revealedCount={revealedCount}
        totalCount={totalCount}
        highlightedCount={highlightedMessageIds.length}
        validatedFindingCount={validatedFindingCount}
        requiredFindingCount={requiredFindingCount}
        hintLevel={hintLevel}
        hintMessage={hintMessage}
        turnRole={turnRole}
        canRevealNext={canRevealNext}
        canEnterReview={canEnterReview}
        onRevealNext={onRevealNext ?? (() => {})}
        onEnterReview={onEnterReview ?? (() => {})}
        onHint={onHint ?? (() => {})}
        onReset={onReset ?? (() => {})}
        onOpenGuide={openGuide}
        onToggleMobileInspector={() => setMobileInspectorOpen(true)}
        isResetting={isResetting}
        autoplay={autoplay}
        autoplaySpeed={autoplaySpeed}
        onToggleAutoplay={onToggleAutoplay}
        onAutoplaySpeedChange={onAutoplaySpeedChange}
      />

      {/* 2. Main Responsive Layout (Scenario on Left, Inspector Rail on Right) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '7fr 5fr' }, gap: { xs: 1.5, sm: 2.5 }, alignItems: 'stretch', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left Column: Scenario Description & Authentic Scenario Surface */}
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
          <ScenarioDescriptionCard scenarioDescription={scenarioDescription} />

          <Paper
            elevation={0}
            sx={{
              p: { xs: 1, sm: 2 },
              borderRadius: 3,
              mt: { xs: 1.5, sm: 2 },
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
            }}
          >
            {/* Scrollable Scenario Box */}
            <Box
              component="section"
              aria-label="Scenario scene"
              ref={sceneRef}
              onScroll={onSceneScroll}
              sx={{
                flex: 1,
                minHeight: 0,
                height: '100%',
                maxHeight: 'none',
                overflowY: 'auto',
                pr: { sm: 0.5 },
                position: 'relative',
              }}
            >
              <SkinRouter
                renderSkin={renderSkin}
                scene={semanticScene}
                selection={{ selectedElementKeys: effectiveSelectionKeys, completedElementKeys }}
                onSelect={handleSelectElementInternal}
                readOnly={false}
                panelNavigation={panelNavigation}
                testId="family-scene-renderer"
              />
            </Box>

            {/* Floating "New Content Below" FAB / Button */}
            {showNewContent && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 16,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 10,
                  animation: 'bounceNewContent 2s infinite',
                  '@keyframes bounceNewContent': {
                    '0%, 20%, 50%, 80%, 100%': { transform: 'translateX(-50%) translateY(0)' },
                    '40%': { transform: 'translateX(-50%) translateY(-6px)' },
                    '60%': { transform: 'translateX(-50%) translateY(-3px)' },
                  },
                }}
              >
                <Fab
                  variant="extended"
                  color="primary"
                  size="small"
                  onClick={onJumpToNewest}
                  sx={{ textTransform: 'none', fontWeight: 700, px: 2, boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}
                >
                  <KeyboardArrowDownIcon sx={{ mr: 0.5 }} /> New content below
                </Fab>
              </Box>
            )}
          </Paper>

          {panelNavigation && (
            <SceneArtifactPanel
              scene={semanticScene}
              selection={{ selectedElementKeys: effectiveSelectionKeys, completedElementKeys }}
              onSelect={handleSelectElementInternal}
              navigation={panelNavigation}
            />
          )}

          {/* Legacy or Custom Companion Children */}
          {companion}
          {children}
        </Box>

        {/* Right Column: Persistent Desktop Inspector Rail & Caregiver Comments */}
        <Box sx={{ minWidth: 0, display: 'block', overflowY: 'auto', maxHeight: 'calc(100vh - 160px)', pr: 0.5 }}>
          <Stack spacing={2}>
            {joinCode && userRole === 'learner' && (
              <Alert severity="info" sx={{ borderRadius: 3 }}>
                Your linked family member can open this session directly from Caregiver Hub. If they need to join by code, share <strong>{joinCode}</strong>.
              </Alert>
            )}
            <PresenceAvatarBar
              participants={participants}
              streamStatus={streamStatus}
              turnRole={turnRole}
              userRole={userRole}
              onReconnect={onReconnectStream}
              onContinueAsync={onContinueAsync}
              onEndLater={onEndTogetherLater}
            />
            {checkpoint}
            <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
              <Stack spacing={2}>
                <FlagInspectorRail
                scenarioTitle={title}
                scenarioDescription={scenarioDescription}
                showContextCard={false}
                messages={messages}
                highlightedMessageIds={highlightedMessageIds}
                tagAssignments={tagAssignments}
                selectedMessageId={selectedMessageId}
                selectedElementKey={selectedElementKey}
                onSelectMessage={handleSelectMessageInternal}
                companionNotice={companionNotice}
                onAskCompanion={handleAskCompanionInternal}
                onSubmitAttempt={onSubmitAttempt}
                pendingAttempt={pendingAttempt}
                lastAttempt={lastAttempt}
                validatedFindings={validatedFindings}
                  isExplaining={isExplaining}
                />

                <CaregiverCommentSection
                  comments={caregiverComments}
                  elementKey={selectedElementKey}
                  canAddComment={canAddComment}
                  onSubmitComment={onSubmitComment}
                  isSubmitting={isSubmittingComment}
                />
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Box>

      {/* 3. Mobile Inspector Drawer */}
      <Drawer
        anchor="right"
        open={mobileInspectorOpen}
        onClose={() => setMobileInspectorOpen(false)}
        slotProps={{ paper: { sx: { width: { xs: '88vw', sm: 380 }, p: { xs: 2, sm: 2.5 } } } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Flag Inspector & Notes
          </Typography>
          <IconButton onClick={() => setMobileInspectorOpen(false)} aria-label="Close inspector drawer">
            <CloseIcon />
          </IconButton>
        </Box>
        <Stack spacing={2}>
          <FlagInspectorRail
            scenarioTitle={title}
            scenarioDescription={scenarioDescription}
            showContextCard={false}
            messages={messages}
            highlightedMessageIds={highlightedMessageIds}
            tagAssignments={tagAssignments}
            selectedMessageId={selectedMessageId}
            selectedElementKey={selectedElementKey}
            onSelectMessage={handleSelectMessageInternal}
            companionNotice={companionNotice}
            onAskCompanion={handleAskCompanionInternal}
            onSubmitAttempt={onSubmitAttempt}
            pendingAttempt={pendingAttempt}
            lastAttempt={lastAttempt}
            validatedFindings={validatedFindings}
            isExplaining={isExplaining}
          />
          <CaregiverCommentSection
            comments={caregiverComments}
            elementKey={selectedElementKey}
            canAddComment={canAddComment}
            onSubmitComment={onSubmitComment}
            isSubmitting={isSubmittingComment}
          />
        </Stack>
      </Drawer>

      {/* 4. Instructions & How to Play Guide Modal */}
      <InstructionsGuideModal open={guideOpen} onClose={closeGuide} />

      {/* 5. Completion Review Modal */}
      <CompletionReviewModal
        open={showReviewModal}
        acknowledged={completionAcknowledged}
        highlightedMessages={highlightedMessages}
        tagAssignments={tagAssignments}
        commandLoading={commandLoading}
        actionError={actionError}
        onAcknowledge={onAcknowledgeCompletion ?? (() => {})}
        onOpenHelp={onOpenHelp ?? (() => {})}
        onFinish={onFinishCompletion ?? (() => {})}
        onCloseReviewScene={() => setReviewSceneDismissed(true)}
        onRetryError={onRetryAction}
        review={review}
        reviewLoading={reviewLoading}
        reviewError={reviewError}
      />
    </Container>
  );
}
