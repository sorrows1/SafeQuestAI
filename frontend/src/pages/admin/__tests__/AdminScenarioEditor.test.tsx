import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { AdminSkinPreviewPanel } from '@/components/admin/AdminSkinPreviewPanel';
import { SkinChooser } from '@/components/admin/SkinChooserCard';
import { SceneTreeOutline } from '@/components/admin/SceneTreeOutline';
import { ElementPropertyInspector } from '@/components/admin/ElementPropertyInspector';
import { AnnotationTacticEditor } from '@/components/admin/AnnotationTacticEditor';
import { ScenarioValidationSummary } from '@/components/admin/ScenarioValidationSummary';
import type { AdminSceneDraft, FamilyScene, SceneAnnotationDraft, SceneElement } from '@/types';

const theme = createTheme();

const sampleScene: FamilyScene = {
  scene_schema_version: 1,
  skin_version: '1.0',
  render_skin: 'chat',
  elements: [
    {
      element_key: 'msg-1',
      element_type: 'message',
      parent_element_key: null,
      source_message_id: 101,
      sequence: 0,
      content: 'Hello, welcome to the test scenario.',
      presentation: {},
      selectable: false,
      accessible_label: 'Message from Alex',
      semantic_role: 'article',
    },
    {
      element_key: 'msg-2',
      element_type: 'message',
      parent_element_key: null,
      source_message_id: 102,
      sequence: 1,
      content: 'Send your password now or else!',
      presentation: {},
      selectable: true,
      accessible_label: 'Message from Aggressor',
      semantic_role: 'article',
    },
  ],
  messages: [
    { id: 101, sequence: 0, speaker_label: 'Alex', content: 'Hello, welcome to the test scenario.', pace: 'normal', is_checkpoint: false, checkpoint_prompt: null },
    { id: 102, sequence: 1, speaker_label: 'Aggressor', content: 'Send your password now or else!', pace: 'normal', is_checkpoint: true, checkpoint_prompt: 'What to do?' },
  ],
};

const sampleAnnotations: SceneAnnotationDraft[] = [
  {
    element_key: 'msg-2',
    tactic_tag: 'boundary_pressure',
    explanation: 'Demanding credentials under threat.',
    tiered_hints: ['Hint level 1: Urgency', 'Hint level 2: Coercion'],
  },
];

describe('Phase 9 —  Admin Scenario Editor & Live Preview UI', () => {
  describe('AdminSkinPreviewPanel', () => {
    it('renders live skin preview with viewport and theme toggles', () => {
      const onSelect = vi.fn();

      render(
        <ThemeProvider theme={theme}>
          <AdminSkinPreviewPanel
            renderSkin="chat"
            scene={sampleScene}
            selectedElementKey="msg-2"
            onSelectElement={onSelect}
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/Live Production Skin Preview/i)).toBeTruthy();

      // Viewport buttons
      const mobileBtn = screen.getByLabelText(/Mobile Viewport/i);
      fireEvent.click(mobileBtn);

      const desktopBtn = screen.getByLabelText(/Desktop Viewport/i);
      fireEvent.click(desktopBtn);

      // Theme toggle buttons
      const lightBtn = screen.getByLabelText(/Light Mode Preview/i);
      fireEvent.click(lightBtn);
    });
  });

  describe('SkinChooser', () => {
    it('renders skin chooser cards and fires selection handler', () => {
      const onSelectSkin = vi.fn();

      render(
        <ThemeProvider theme={theme}>
          <SkinChooser selectedSkin="chat" onSelectSkin={onSelectSkin} />
        </ThemeProvider>
      );

      expect(screen.getByText('Instant Chat')).toBeTruthy();
      expect(screen.getByText('Email Thread')).toBeTruthy();
      expect(screen.getByText('Social Feed')).toBeTruthy();

      const emailCard = screen.getByText('Email Thread');
      fireEvent.click(emailCard);
      expect(onSelectSkin).toHaveBeenCalledWith('email');
    });
  });

  describe('SceneTreeOutline & ElementPropertyInspector', () => {
    it('renders element tree outline and updates element properties on change', () => {
      const onSelect = vi.fn();
      const onUpdate = vi.fn();

      render(
        <ThemeProvider theme={theme}>
          <SceneTreeOutline
            elements={sampleScene.elements}
            selectedKey="msg-2"
            onSelectElement={onSelect}
            annotatedElementKeys={['msg-2']}
          />
          <ElementPropertyInspector
            element={sampleScene.elements[1]}
            allElements={sampleScene.elements}
            supportedElementTypes={['message', 'profile']}
            onUpdateElement={onUpdate}
          />
        </ThemeProvider>
      );

      expect(screen.getByText('Scene Elements (2)')).toBeTruthy();
      expect(screen.getByText('Inspect Element Properties: msg-2')).toBeTruthy();

      const keyInput = screen.getByLabelText('Stable Element Key');
      fireEvent.change(keyInput, { target: { value: 'msg-2-renamed' } });
      expect(onUpdate).toHaveBeenCalledWith('msg-2', { element_key: 'msg-2-renamed' });
    });
  });

  describe('AnnotationTacticEditor', () => {
    it('renders annotation editor with taxonomy dropdown and tiered hints', () => {
      const onUpdate = vi.fn();
      const onAdd = vi.fn();
      const onRemove = vi.fn();

      render(
        <ThemeProvider theme={theme}>
          <AnnotationTacticEditor
            annotations={sampleAnnotations}
            selectableElements={[sampleScene.elements[1]]}
            categoryTags={['boundary_pressure', 'secret_keeping']}
            onUpdateAnnotation={onUpdate}
            onAddAnnotation={onAdd}
            onRemoveAnnotation={onRemove}
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/Red-Flag Annotations & Tactics \(1\)/i)).toBeTruthy();
      expect(screen.getByText('Demanding credentials under threat.')).toBeTruthy();

      const removeBtn = screen.getByText('Remove');
      fireEvent.click(removeBtn);
      expect(onRemove).toHaveBeenCalledWith(0);
    });
  });

  describe('ScenarioValidationSummary', () => {
    it('categorizes and displays publish blockers and warnings', () => {
      const sampleDraft: AdminSceneDraft = {
        category: 'cyberbullying',
        scene: { ...sampleScene, elements: [{ ...sampleScene.elements[0], selectable: false }] },
        annotations: [],
      };

      render(
        <ThemeProvider theme={theme}>
          <ScenarioValidationSummary
            draft={sampleDraft}
            bindingIssues={['Initiator persona is required']}
          />
        </ThemeProvider>
      );

      expect(screen.getByText('🔴 Publish Blockers (2)')).toBeTruthy();
      expect(screen.getByText('Initiator persona is required')).toBeTruthy();
      expect(screen.getByText('No selectable red-flag target exists in the scene.')).toBeTruthy();
    });
  });
});
