import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCreateFamilySessionMutation, useGetFamilyScenariosQuery, useRestartFamilySessionMutation } from '@/store/api';
import type { FamilyScenarioQuery, PublishedFamilyScenario, RenderSkin } from '@/types';
import { FamilyAppShell } from '@/components/family/FamilyAppShell';
import { ScenarioBrowserView } from './ScenarioBrowserView';
import { CaregiverSelectorModal } from '@/components/family/CaregiverSelectorModal';
import { InviteFamilyMemberModal } from '@/components/family/InviteFamilyMemberModal';

export function FamilyScenarioLobby() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState(searchParams.get('search') ?? '');
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [category, setCategory] = useState<string[]>(searchParams.getAll('category'));
  const [difficulty, setDifficulty] = useState<string[]>(searchParams.getAll('difficulty'));
  const [renderSkin, setRenderSkin] = useState<RenderSkin[]>(searchParams.getAll('render_skin') as RenderSkin[]);
  const [sort, setSort] = useState<FamilyScenarioQuery['sort']>(() => {
    const value = searchParams.get('sort');
    return value === 'title' || value === 'difficulty' || value === 'shortest' ? value : 'newest';
  });
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page')) || 1));
  const [selected, setSelected] = useState<PublishedFamilyScenario | null>(null);
  const [selectorModalOpen, setSelectorModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const relationshipContext = searchParams.get('with');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(input.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set('search', search);
    category.forEach((value) => next.append('category', value));
    difficulty.forEach((value) => next.append('difficulty', value));
    renderSkin.forEach((value) => next.append('render_skin', value));
    if (sort && sort !== 'newest') next.set('sort', sort);
    if (page > 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [category, difficulty, page, renderSkin, search, setSearchParams, sort]);

  const filters = useMemo<FamilyScenarioQuery>(
    () => ({
      search: search || undefined,
      category: category.length ? category : undefined,
      difficulty: difficulty.length ? difficulty : undefined,
      render_skin: renderSkin.length ? renderSkin : undefined,
      sort,
      page,
      limit: 12,
    }),
    [search, category, difficulty, renderSkin, sort, page]
  );

  const { data, isLoading, isFetching, isError, error: queryError, refetch } = useGetFamilyScenariosQuery(filters);
  const queryStatus = (queryError as { status?: number | string } | undefined)?.status;
  const [createSession, { isLoading: creating, error }] = useCreateFamilySessionMutation();
  const [restartSession, { isLoading: restarting, error: restartError }] = useRestartFamilySessionMutation();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const filtered = Boolean(search || category.length || difficulty.length || renderSkin.length || sort !== 'newest');

  const toggle = <T,>(current: T[], value: T, update: (next: T[]) => void) => {
    update(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    setPage(1);
  };

  const clear = () => {
    setInput('');
    setSearch('');
    setCategory([]);
    setDifficulty([]);
    setRenderSkin([]);
    setSort('newest');
    setPage(1);
  };

  const navigateToSession = (scenario: PublishedFamilyScenario, session: { public_id?: string | null; session_ref?: string | null; id: number }) => {
    const sessionRefOrId = session.session_ref || session.public_id || session.id;
    navigate('/family/scenarios/' + scenario.id + '/sessions/' + sessionRefOrId, { state: { session } });
  };

  const handleScenarioClick = (item: PublishedFamilyScenario | null) => {
    if (item?.lifecycle === 'active' && item.session_ref) {
      navigate('/family/scenarios/' + item.id + '/sessions/' + item.session_ref);
      return;
    }
    setSelected(item);
  };

  const handleOpenSelector = () => {
    setSelectorModalOpen(true);
  };

  const handleLifecycleAction = async () => {
    if (!selected) return;
    if (selected.lifecycle !== 'completed' || !selected.session_ref) {
      handleOpenSelector();
      return;
    }
    try {
      const session = await restartSession({ transcriptId: selected.id, prior_session_ref: selected.session_ref }).unwrap();
      setSelected(null);
      navigateToSession(selected, session);
    } catch {
      // Error is rendered through the existing mutation feedback state.
    }
  };

  const handleStartMode = (mode: 'solo_with_companion' | 'family_invite' | 'join_family') => {
    if (mode === 'join_family') {
      setSelected(null);
      navigate('/family/hub');
      return;
    }
    if (mode === 'solo_with_companion') {
      void handleStartSession();
      return;
    }
    setSelectorModalOpen(true);
  };

  const handleStartSession = async (relationshipRef?: string) => {
    if (!selected) return;
    try {
      const session = await createSession({
        transcriptId: selected.id,
        relationship_ref: relationshipRef || relationshipContext || undefined,
      }).unwrap();
      setSelectorModalOpen(false);
      setSelected(null);
      navigateToSession(selected, session);
    } catch {
      // Error handled by RTK mutation error state
    }
  };

  return (
    <FamilyAppShell>
      <ScenarioBrowserView
        items={items}
        total={total}
        page={page}
        input={input}
        onInputChange={setInput}
        category={category}
        onToggleCategory={(val) => toggle(category, val, setCategory)}
        difficulty={difficulty}
        onToggleDifficulty={(val) => toggle(difficulty, val, setDifficulty)}
        renderSkin={renderSkin}
        onToggleSkin={(val) => toggle(renderSkin, val, setRenderSkin)}
        sort={sort}
        onSortChange={(val) => {
          setSort(val);
          setPage(1);
        }}
        onPageChange={setPage}
        filtered={filtered}
        onClearFilters={clear}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        queryStatus={queryStatus}
        onRefetch={refetch}
        selected={selected}
        onSelectScenario={handleScenarioClick}
        onStartSolo={handleLifecycleAction}
        onStartMode={handleStartMode}
        creating={creating || restarting}
        createError={Boolean(error || restartError)}
      />

      {/* Caregiver Selector Modal when starting a scenario */}
      {selected && (
        <CaregiverSelectorModal
          open={selectorModalOpen}
          scenarioTitle={selected.title}
          onClose={() => setSelectorModalOpen(false)}
          onConfirm={(relRef) => handleStartSession(relRef)}
          onOpenInviteModal={() => {
            setSelectorModalOpen(false);
            setInviteModalOpen(true);
          }}
          isStarting={creating}
        />
      )}

      {/* Invite Family Member Modal */}
      <InviteFamilyMemberModal open={inviteModalOpen} onClose={() => setInviteModalOpen(false)} />
    </FamilyAppShell>
  );
}
