import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCreateFamilySessionMutation, useGetFamilyScenariosQuery } from '@/store/api';
import type { FamilyScenarioQuery, PublishedFamilyScenario, RenderSkin } from '@/types';
import { FamilyAppShell } from '@/components/family/FamilyAppShell';
import { ScenarioBrowserView } from './ScenarioBrowserView';

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

  const start = async () => {
    if (!selected) return;
    const session = await createSession({
      transcriptId: selected.id,
    }).unwrap();
    navigate('/family/scenarios/' + selected.id + '/sessions/' + session.id, { state: { session } });
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
        onSelectScenario={setSelected}
        onStartSolo={start}
        creating={creating}
        createError={Boolean(error)}
      />
    </FamilyAppShell>
  );
}
