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
  FamilyCaregiverComment,
  FamilyMessage,
  FamilyScene,
  FamilySessionParticipant,
  FlagAttempt,
  RenderSkin,
  ValidatedFinding,
} from '@/types';
import { GameplayMissionBar } from '@/components/family/GameplayMissionBar';
import { FlagInspectorRail } from '@/components/family/FlagInspectorRail';
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

  // Mission bar & Inspector shell metadata
  title?: string;
  category?: string;
  state?: string;
  totalCount?: number;
  scenarioDescription?: string;
  hintLevel?: number;
  onHint?: () => void;
  onReset?: () => void;
  isResetting?: boolean;

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

  title = 'Family Safety Scenario',
  category,
  state = 'active',
  totalCount = messages.length,
  scenarioDescription,
  hintLevel = 0,
  onHint,
  onReset,
  isResetting = false,

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
}: FamilyGameplayViewProps) {
  const semanticScene: FamilyScene = scene ?? {
    scene_schema_version: 1, skin_version: "1.0", render_skin: renderSkin, elements: messages.map((message) => ({ element_key: "legacy-" + message.id, element_type: "message", parent_element_key: null, source_message_id: message.id, sequence: message.sequence, content: message.content, presentation: {}, selectable: true, accessible_label: "Message from " + message.speaker_label, semantic_role: "article" })), messages,
  };
  const [guideOpen, setGuideOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [reviewSceneDismissed, setReviewSceneDismissed] = useState(false);

  const highlightedMessages = messages.filter((m) => highlightedMessageIds.includes(m.id));

  const handleToggleMessageInternal = (messageId: number) => {
    setSelectedMessageId(messageId);
    onToggleMessage(messageId);
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

  const handleSelectElementInternal = (elementKey: string) => {
    onSelectElement(elementKey);
    const panelTarget = panelTargetFor(semanticScene, elementKey);
    if (panelTarget) panelNavigation?.openPanel(panelTarget);
    if (elementKey.startsWith("legacy-")) {
      const msgId = parseInt(elementKey.replace("legacy-", ""), 10);
      if (!isNaN(msgId)) {
        onToggleMessage(msgId);
      }
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3 } }}>
      {/* 1. Top Mission Bar */}
      <GameplayMissionBar
        title={title}
        category={category}
        renderSkin={renderSkin}
        state={state}
        revealedCount={messages.length}
        totalCount={totalCount}
        highlightedCount={highlightedMessageIds.length}
        hintLevel={hintLevel}
        turnRole={turnRole}
        onHint={onHint ?? (() => {})}
        onReset={onReset ?? (() => {})}
        onOpenGuide={() => setGuideOpen(true)}
        onToggleMobileInspector={() => setMobileInspectorOpen(true)}
        isResetting={isResetting}
      />

      {/* Presence & Stream Status Banner */}
      <PresenceAvatarBar
        participants={participants}
        streamStatus={streamStatus}
        turnRole={turnRole}
        userRole={userRole}
        onReconnect={onReconnectStream}
        onContinueAsync={onContinueAsync}
        onEndLater={onEndTogetherLater}
      />

      {/* 2. Main Responsive Layout (Scenario on Left, Inspector Rail on Right) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '7fr 5fr' }, gap: 3, alignItems: 'start' }}>
        {/* Left Column: Authentic Scenario Surface & Checkpoint */}
        <Box sx={{ minWidth: 0 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.5, sm: 2.5 },
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              position: 'relative',
            }}
          >
            {/* Scrollable Scenario Box */}
            <Box
              component="section"
              aria-label="Scenario scene"
              ref={sceneRef}
              onScroll={onSceneScroll}
              sx={{
                maxHeight: { xs: '52vh', sm: '58vh', lg: '62vh' },
                minHeight: 320,
                overflowY: 'auto',
                pr: { sm: 1 },
                position: 'relative',
              }}
            >
              <SkinRouter
                renderSkin={renderSkin}
                scene={semanticScene}
                selection={{ selectedElementKeys: effectiveSelectionKeys }}
                onSelect={handleSelectElementInternal}
                readOnly={false}
                panelNavigation={panelNavigation}
                testId="family-scene-renderer"
              />
            </Box>

            {/* Floating "New Content Below" FAB / Button */}
            {showNewContent && (
              <Box sx={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                <Fab
                  variant="extended"
                  color="primary"
                  size="small"
                  onClick={onJumpToNewest}
                  sx={{ textTransform: 'none', fontWeight: 700, px: 2, boxShadow: 4 }}
                >
                  <KeyboardArrowDownIcon sx={{ mr: 0.5 }} /> New content below
                </Fab>
              </Box>
            )}
          </Paper>

          {panelNavigation && (
            <SceneArtifactPanel
              scene={semanticScene}
              selection={{ selectedElementKeys: effectiveSelectionKeys }}
              onSelect={handleSelectElementInternal}
              navigation={panelNavigation}
            />
          )}

          {/* Compact Checkpoint Pause Card */}
          {checkpoint}

          {/* Legacy or Custom Companion Children */}
          {companion}
          {children}
        </Box>

        {/* Right Column: Persistent Desktop Inspector Rail & Caregiver Comments */}
        <Box sx={{ minWidth: 0, display: { xs: 'none', lg: 'block' } }}>
          <Stack spacing={2.5}>
            <FlagInspectorRail
              scenarioTitle={title}
              scenarioDescription={scenarioDescription}
              messages={messages}
              highlightedMessageIds={highlightedMessageIds}
              tagAssignments={tagAssignments}
              selectedMessageId={selectedMessageId}
              selectedElementKey={selectedElementKey}
              onSelectMessage={setSelectedMessageId}
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
      </Box>

      {/* 3. Mobile Inspector Drawer */}
      <Drawer
        anchor="right"
        open={mobileInspectorOpen}
        onClose={() => setMobileInspectorOpen(false)}
        slotProps={{ paper: { sx: { width: { xs: '85vw', sm: 380 }, p: 2.5 } } }}
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
            messages={messages}
            highlightedMessageIds={highlightedMessageIds}
            tagAssignments={tagAssignments}
            selectedMessageId={selectedMessageId}
            selectedElementKey={selectedElementKey}
            onSelectMessage={setSelectedMessageId}
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
      <InstructionsGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />

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
      />
    </Container>
  );
}
