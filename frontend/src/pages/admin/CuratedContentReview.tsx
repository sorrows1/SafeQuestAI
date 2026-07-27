import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { AppShell } from '@/components/common/AppShell';
import {
  useGetCuratedSceneReviewQuery,
  useGetSceneCapabilitiesQuery,
  usePreviewSceneDraftMutation,
  usePublishCuratedTranscriptMutation,
  useUpdateCuratedSceneReviewMutation,
} from '@/store/api';
import type { AdminSceneDraft, SceneAnnotationDraft, SceneElement } from '@/types';
import { AdminSkinPreviewPanel } from '@/components/admin/AdminSkinPreviewPanel';
import { SceneTreeOutline } from '@/components/admin/SceneTreeOutline';
import { ElementPropertyInspector } from '@/components/admin/ElementPropertyInspector';
import { AnnotationTacticEditor } from '@/components/admin/AnnotationTacticEditor';
import { ScenarioValidationSummary } from '@/components/admin/ScenarioValidationSummary';

const blankAnnotation = (element_key: string, tactic_tag: string): SceneAnnotationDraft => ({
  element_key,
  tactic_tag,
  explanation: '',
  tiered_hints: [],
});

export function CuratedContentReview() {
  const { id } = useParams<{ id: string }>();
  const transcriptId = Number(id);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { data: fetched, isLoading, error } = useGetCuratedSceneReviewQuery(transcriptId, {
    skip: !Number.isFinite(transcriptId),
  });
  const { data: capabilities } = useGetSceneCapabilitiesQuery();
  const [draft, setDraft] = useState<AdminSceneDraft | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [saveReview, { isLoading: saving }] = useUpdateCuratedSceneReviewMutation();
  const [validatePreview, { isLoading: validating }] = usePreviewSceneDraftMutation();
  const [publish, { isLoading: publishing }] = usePublishCuratedTranscriptMutation();

  useEffect(() => {
    if (fetched && !draft) {
      setDraft(fetched);
      if (fetched.scene.elements.length > 0 && !selectedKey) {
        setSelectedKey(fetched.scene.elements[0].element_key);
      }
    }
  }, [fetched, draft, selectedKey]);

  const supportedTypes = useMemo(
    () => capabilities?.skins.find((skin) => skin.id === draft?.scene.render_skin)?.supported_element_types ?? [],
    [capabilities, draft?.scene.render_skin]
  );
  const tagOptions = draft && capabilities ? capabilities.tactic_tags_by_category[draft.category] ?? [] : [];

  const selectedElement = useMemo(
    () => draft?.scene.elements.find((el) => el.element_key === selectedKey) ?? null,
    [draft, selectedKey]
  );

  const updateElement = (element_key: string, change: Partial<SceneElement>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            scene: {
              ...current.scene,
              elements: current.scene.elements.map((element) =>
                element.element_key === element_key ? { ...element, ...change } : element
              ),
            },
            annotations: current.annotations.map((annotation) =>
              annotation.element_key === element_key && change.element_key
                ? { ...annotation, element_key: change.element_key }
                : annotation
            ),
          }
        : null
    );

  const addArtifactElement = () =>
    setDraft((current) =>
      current
        ? {
            ...current,
            scene: {
              ...current.scene,
              elements: [
                ...current.scene.elements,
                {
                  element_key: `artifact-${current.scene.elements.length + 1}`,
                  element_type: supportedTypes[0] ?? 'message',
                  parent_element_key: null,
                  source_message_id: null,
                  sequence: current.scene.elements.length,
                  content: '',
                  presentation: {},
                  selectable: true,
                  accessible_label: 'New non-message artifact',
                  semantic_role: 'article',
                },
              ],
            },
          }
        : null
    );

  const updateAnnotation = (index: number, change: Partial<SceneAnnotationDraft>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            annotations: current.annotations.map((annotation, currentIndex) =>
              currentIndex === index ? { ...annotation, ...change } : annotation
            ),
          }
        : null
    );

  const addAnnotation = (targetKey: string, tag: string) =>
    setDraft((current) =>
      current ? { ...current, annotations: [...current.annotations, blankAnnotation(targetKey, tag)] } : null
    );

  const removeAnnotation = (index: number) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            annotations: current.annotations.filter((_, currentIndex) => currentIndex !== index),
          }
        : null
    );

  const validate = async () => {
    if (!draft) return;
    try {
      await validatePreview(draft).unwrap();
      enqueueSnackbar('Draft is compatible with the production scene contract.', { variant: 'success' });
    } catch (issue: any) {
      enqueueSnackbar(issue?.data?.detail ?? 'Preview validation failed', { variant: 'error' });
    }
  };

  const save = async () => {
    if (!draft) return;
    try {
      setDraft(await saveReview({ id: transcriptId, body: draft }).unwrap());
      enqueueSnackbar('Scene and annotations saved for review.', { variant: 'success' });
    } catch (issue: any) {
      enqueueSnackbar(issue?.data?.detail ?? 'Review save failed', { variant: 'error' });
    }
  };

  const publishReviewed = async () => {
    try {
      await publish(transcriptId).unwrap();
      enqueueSnackbar('Published after scene and annotation validation.', { variant: 'success' });
      navigate('/admin/review-queue');
    } catch (issue: any) {
      enqueueSnackbar(issue?.data?.detail ?? 'Publication is blocked', { variant: 'error' });
    }
  };

  const selectableElements = useMemo(
    () => draft?.scene.elements.filter((el) => el.selectable) ?? [],
    [draft]
  );
  const annotatedElementKeys = useMemo(
    () => draft?.annotations.map((a) => a.element_key) ?? [],
    [draft]
  );

  return (
    <AppShell>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto' }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Inspectable Content & Red-Flag Annotation Review
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Review selectable content, ground-truth annotations, and live player previews before separate publication.
        </Typography>

        {isLoading && <CircularProgress size={28} />}
        {error && <Alert severity="error">This curated transcript could not be loaded.</Alert>}

        {draft && (
          <Stack spacing={3}>
            {/* Validation Summary */}
            <ScenarioValidationSummary draft={draft} supportedElementTypes={supportedTypes} />

            {/* Split Layout: Left tree/inspector/annotations, Right live preview */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '5fr 7fr' }, gap: 3, alignItems: 'start' }}>
              {/* Left Column: Tree, Property Inspector, Annotation Editor */}
              <Stack spacing={2.5} sx={{ minWidth: 0 }}>
                <SceneTreeOutline
                  elements={draft.scene.elements}
                  selectedKey={selectedKey}
                  onSelectElement={setSelectedKey}
                  onAddElement={addArtifactElement}
                  annotatedElementKeys={annotatedElementKeys}
                />

                <ElementPropertyInspector
                  element={selectedElement}
                  allElements={draft.scene.elements}
                  supportedElementTypes={supportedTypes}
                  onUpdateElement={updateElement}
                />

                <AnnotationTacticEditor
                  annotations={draft.annotations}
                  selectableElements={selectableElements}
                  categoryTags={tagOptions}
                  onUpdateAnnotation={updateAnnotation}
                  onAddAnnotation={addAnnotation}
                  onRemoveAnnotation={removeAnnotation}
                  selectedElementKey={selectedKey}
                />
              </Stack>

              {/* Right Column: Live Production Skin Preview */}
              <Box sx={{ minWidth: 0, position: 'sticky', top: 20 }}>
                <AdminSkinPreviewPanel
                  renderSkin={draft.scene.render_skin}
                  scene={draft.scene}
                  selectedElementKey={selectedKey}
                  onSelectElement={setSelectedKey}
                />
              </Box>
            </Box>

            {/* Bottom Action Bar */}
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', position: 'sticky', bottom: 16, zIndex: 10, bgcolor: 'background.paper', boxShadow: 3 }}>
              <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
                <Button variant="outlined" onClick={validate} disabled={validating}>
                  Validate Preview
                </Button>
                <Button variant="contained" onClick={save} disabled={saving}>
                  Save Review
                </Button>
                <Button color="success" variant="contained" onClick={publishReviewed} disabled={publishing}>
                  Publish Reviewed Content
                </Button>
              </Stack>
            </Paper>
          </Stack>
        )}
      </Box>
    </AppShell>
  );
}
