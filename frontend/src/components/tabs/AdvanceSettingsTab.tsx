// src/components/tabs/AdvanceSettingsTab.tsx
import React, { useEffect, useMemo, useState } from 'react';
import './Tabs.css';

type Country = { id: number; name: string };

type SettingsRow = {
  country_id: number;
  country_name: string;
  cpi: number | null;
  activity_rate: number | null;
  npt_rate: number | null;
  it_cost: number | null;
  premises_cost: number | null;
  working_days: number | null;
  hours_per_day: number | null;
  mng: number | null;
  markup: number | null;
  social_contribution_rate: number | null;
};

type ParamKey = 'cpi' | 'activity_rate' | 'npt_rate' | 'it_cost' | 'premises_cost' | 'working_days' | 'hours_per_day' | 'mng' | 'markup' | 'social_contribution_rate';

interface Props {
  projectId: number | string;
  countries: Country[]; // Only the project's countries
}

const numberFormat = (n: number | null | undefined) =>
  n == null || isNaN(Number(n)) ? '' : String(Number(n));

export const AdvanceSettingsTab: React.FC<Props> = ({ projectId, countries }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SettingsRow[]>([]);
  const [editingRow, setEditingRow] = useState<number | null>(null); // country_id in edit
  const [dirty, setDirty] = useState<Record<number, Partial<Record<ParamKey, number>>>>({});

  // Load per-parameter values and merge into a single table
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [cpiRes, arRes, nptRes, itRes, premRes, wdRes, hpdRes, mngRes, mkRes, scrRes] = await Promise.all([
          fetch(`/projects/${projectId}/countries-cpi`),
          fetch(`/projects/${projectId}/countries-activity-rate`),
          fetch(`/projects/${projectId}/countries-npt-rate`),
          fetch(`/projects/${projectId}/countries-it-cost`),
          fetch(`/projects/${projectId}/countries-premises-cost`),
          fetch(`/projects/${projectId}/countries-working-days`),
          fetch(`/projects/${projectId}/countries-hours-per-day`),
          fetch(`/projects/${projectId}/countries-mng`),
          fetch(`/projects/${projectId}/countries-markup`),
          fetch(`/projects/${projectId}/countries-social-contribution-rate`),
        ]);
        if (!cpiRes.ok) throw new Error('Error cargando CPI del proyecto');
        if (!arRes.ok) throw new Error('Error cargando Activity Rate del proyecto');
        if (!nptRes.ok) throw new Error('Error cargando NPT Rate del proyecto');
        if (!itRes.ok) throw new Error('Error cargando IT Cost del proyecto');
        if (!premRes.ok) throw new Error('Error cargando Premises Cost del proyecto');
        if (!wdRes.ok) throw new Error('Error cargando Working Days del proyecto');
        const [cpiJson, arJson, nptJson, itJson, premJson, wdJson, hpdJson, mngJson, mkJson, scrJson] = await Promise.all([
          cpiRes.json(),
          arRes.json(),
          nptRes.json(),
          itRes.json(),
          premRes.json(),
          wdRes.json(),
          hpdRes.json(),
          mngRes.json(),
          mkRes.json(),
          scrRes.json(),
        ]);

        if (cancelled) return;

        const cpiMap = new Map<number, number | null>((cpiJson || []).map((r: any) => [r.country_id, r.cpi]));
        const arMap = new Map<number, number | null>((arJson || []).map((r: any) => [r.country_id, r.activity_rate]));
        const nptMap = new Map<number, number | null>((nptJson || []).map((r: any) => [r.country_id, r.npt_rate]));
        const itMap = new Map<number, number | null>((itJson || []).map((r: any) => [r.country_id, r.it_cost]));
  const premMap = new Map<number, number | null>((premJson || []).map((r: any) => [r.country_id, r.premises_cost]));
  const wdMap = new Map<number, number | null>((wdJson || []).map((r: any) => [r.country_id, r.working_days]));
  const hpdMap = new Map<number, number | null>((hpdJson || []).map((r: any) => [r.country_id, r.hours_per_day]));
  const mngMap = new Map<number, number | null>((mngJson || []).map((r: any) => [r.country_id, r.mng]));
  const mkMap = new Map<number, number | null>((mkJson || []).map((r: any) => [r.country_id, r.markup]));
  const scrMap = new Map<number, number | null>((scrJson || []).map((r: any) => [r.country_id, r.social_contribution_rate]));

        const merged: SettingsRow[] = countries
          .map((c) => ({
            country_id: c.id,
            country_name: c.name,
            cpi: cpiMap.get(c.id) ?? null,
            activity_rate: arMap.get(c.id) ?? null,
            npt_rate: nptMap.get(c.id) ?? null,
            it_cost: itMap.get(c.id) ?? null,
            premises_cost: premMap.get(c.id) ?? null,
            working_days: wdMap.get(c.id) ?? null,
            hours_per_day: hpdMap.get(c.id) ?? null,
            mng: mngMap.get(c.id) ?? null,
            markup: mkMap.get(c.id) ?? null,
            social_contribution_rate: scrMap.get(c.id) ?? null,
          }))
          .sort((a, b) => a.country_name.localeCompare(b.country_name));

        setRows(merged);
        setError(null);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setError(e?.message || 'Error cargando datos');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [projectId]);
  const rowsById = useMemo(() => new Map<number, SettingsRow>(rows.map(r => [r.country_id, r])), [rows]);

  const startRowEdit = (countryId: number) => {
    const row = rowsById.get(countryId);
    if (!row) return;
    setEditingRow(countryId);
    setDirty(prev => ({
      ...prev,
      [countryId]: {
        cpi: row.cpi ?? 0,
        activity_rate: row.activity_rate ?? 0,
        npt_rate: row.npt_rate ?? 0,
        it_cost: row.it_cost ?? 0,
  premises_cost: row.premises_cost ?? 0,
  working_days: row.working_days ?? 0,
  hours_per_day: row.hours_per_day ?? 0,
        mng: row.mng ?? 0,
        markup: row.markup ?? 0,
  social_contribution_rate: row.social_contribution_rate ?? 0,
      },
    }));
  };

  const cancelRowEdit = (countryId: number) => {
    setEditingRow(curr => (curr === countryId ? null : curr));
    setDirty(prev => { const p = { ...prev }; delete p[countryId]; return p; });
  };

  const onChangeField = (countryId: number, key: ParamKey, val: string) => {
    const parsed = Number(val);
    setDirty(prev => ({
      ...prev,
      [countryId]: {
        ...(prev[countryId] || {}),
        [key]: isNaN(parsed) || parsed < 0 ? NaN : parsed,
      },
    }));
  };

  const saveRow = async (countryId: number) => {
    const draft = dirty[countryId];
    const row = rowsById.get(countryId);
    if (!draft || !row) return;

    // Validate: no NaN values
    const hasInvalid = Object.values(draft).some((v) => v == null || isNaN(Number(v)));
    if (hasInvalid) return;

    // Determine which fields changed vs current row
    const changes: Partial<Record<ParamKey, number>> = {};
  (['cpi', 'activity_rate', 'npt_rate', 'it_cost', 'premises_cost', 'working_days', 'hours_per_day', 'mng', 'markup', 'social_contribution_rate'] as ParamKey[]).forEach((k) => {
      const newVal = draft[k];
      if (typeof newVal === 'number' && newVal !== (row[k] ?? null)) {
        changes[k] = newVal;
      }
    });

    // Nothing to save
    if (Object.keys(changes).length === 0) {
      setEditingRow(null);
      setDirty(prev => { const p = { ...prev }; delete p[countryId]; return p; });
      return;
    }

    try {
      // Fire only the necessary requests
      const calls: Promise<Response>[] = [];
      if (changes.cpi !== undefined) {
        calls.push(fetch(`/projects/${projectId}/countries-cpi/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cpi: changes.cpi }),
        }));
      }
      if (changes.activity_rate !== undefined) {
        calls.push(fetch(`/projects/${projectId}/countries-activity-rate/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activity_rate: changes.activity_rate }),
        }));
      }
      if (changes.npt_rate !== undefined) {
        calls.push(fetch(`/projects/${projectId}/countries-npt-rate/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ npt_rate: changes.npt_rate }),
        }));
      }
      if (changes.it_cost !== undefined) {
        calls.push(fetch(`/projects/${projectId}/countries-it-cost/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ it_cost: changes.it_cost }),
        }));
      }
      if (changes.premises_cost !== undefined) {
        calls.push(fetch(`/projects/${projectId}/countries-premises-cost/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ premises_cost: changes.premises_cost }),
        }));
      }
      if (changes.working_days !== undefined) {
        calls.push(fetch(`/projects/${projectId}/countries-working-days/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ working_days: changes.working_days }),
        }));
      }
      if (changes.hours_per_day !== undefined) {
        calls.push(fetch(`/projects/${projectId}/countries-hours-per-day/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hours_per_day: changes.hours_per_day }),
        }));
      }
      if (changes.mng !== undefined) {
        calls.push(fetch(`/projects/${projectId}/countries-mng/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mng: changes.mng }),
        }));
      }
      if (changes.markup !== undefined) {
        calls.push(fetch(`/projects/${projectId}/countries-markup/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markup: changes.markup }),
        }));
      }
      if (changes.social_contribution_rate !== undefined) {
        calls.push(fetch(`/projects/${projectId}/countries-social-contribution-rate/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ social_contribution_rate: changes.social_contribution_rate }),
        }));
      }

      const results = await Promise.all(calls);
      const bad = results.find(r => !r.ok);
      if (bad) throw new Error('Error guardando cambios');

      // Apply changes locally
  setRows(prev => prev.map(r => r.country_id === countryId ? ({ ...r, ...changes }) : r));
      setEditingRow(null);
      setDirty(prev => { const p = { ...prev }; delete p[countryId]; return p; });
    } catch (e) {
      console.error(e);
      // Keep dirty for retry
    }
  };

  if (loading) return <div className="tab-container"><div className="tab-header"><h1>Advance Setting</h1></div><div className="tab-content">Cargando…</div></div>;
  if (error) return <div className="tab-container"><div className="tab-header"><h1>Advance Setting</h1></div><div className="tab-content">{error}</div></div>;

  return (
    <div className="tab-container">
      <div className="tab-header">
        <h1>Advance Setting</h1>
      </div>
      <div className="tab-content">
        <div style={{ overflowX: 'auto' }}>
          <table className="settings-table">
            <thead>
              <tr>
                <th>País</th>
                <th>CPI</th>
                <th>Activity Rate</th>
                <th>NPT Rate</th>
                <th>IT Cost</th>
                <th>Premises Cost</th>
                <th>Working Days</th>
                <th>Hours per Day</th>
                <th>%Mng</th>
                <th>Markup</th>
                <th>Social Contribution Rate</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const draft = dirty[row.country_id] || {};
                const invalid = Object.values(draft).some(v => v == null || isNaN(Number(v)));
                const isEditing = editingRow === row.country_id;
                const v = (k: ParamKey) => (draft[k] !== undefined ? (draft[k] as number) : (row[k] ?? 0));
                return (
                  <tr key={row.country_id} className="settings-row">
                    <td>{row.country_name}</td>
                    <td>
                      {isEditing ? (
                        <input className="settings-input" type="number" step="0.01" min={0} value={numberFormat(v('cpi'))} onChange={(e) => onChangeField(row.country_id, 'cpi', e.target.value)} />
                      ) : (
                        <span className="settings-value">{row.cpi == null ? '-' : Number(row.cpi).toFixed(2)}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="settings-input" type="number" step="0.01" min={0} value={numberFormat(v('activity_rate'))} onChange={(e) => onChangeField(row.country_id, 'activity_rate', e.target.value)} />
                      ) : (
                        <span className="settings-value">{row.activity_rate == null ? '-' : Number(row.activity_rate).toFixed(2)}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="settings-input" type="number" step="0.01" min={0} value={numberFormat(v('npt_rate'))} onChange={(e) => onChangeField(row.country_id, 'npt_rate', e.target.value)} />
                      ) : (
                        <span className="settings-value">{row.npt_rate == null ? '-' : Number(row.npt_rate).toFixed(2)}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="settings-input" type="number" step="0.01" min={0} value={numberFormat(v('it_cost'))} onChange={(e) => onChangeField(row.country_id, 'it_cost', e.target.value)} />
                      ) : (
                        <span className="settings-value">{row.it_cost == null ? '-' : Number(row.it_cost).toFixed(2)}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="settings-input" type="number" step="0.01" min={0} value={numberFormat(v('premises_cost'))} onChange={(e) => onChangeField(row.country_id, 'premises_cost', e.target.value)} />
                      ) : (
                        <span className="settings-value">{row.premises_cost == null ? '-' : Number(row.premises_cost).toFixed(2)}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="settings-input" type="number" step="1" min={0} value={numberFormat(v('working_days'))} onChange={(e) => onChangeField(row.country_id, 'working_days', e.target.value)} />
                      ) : (
                        <span className="settings-value">{row.working_days == null ? '-' : Number(row.working_days).toFixed(0)}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="settings-input" type="number" step="0.25" min={0} value={numberFormat(v('hours_per_day'))} onChange={(e) => onChangeField(row.country_id, 'hours_per_day', e.target.value)} />
                      ) : (
                        <span className="settings-value">{row.hours_per_day == null ? '-' : Number(row.hours_per_day).toFixed(2)}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="settings-input" type="number" step="0.01" min={0} value={numberFormat(v('mng'))} onChange={(e) => onChangeField(row.country_id, 'mng', e.target.value)} />
                      ) : (
                        <span className="settings-value">{row.mng == null ? '-' : Number(row.mng).toFixed(2)}%</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="settings-input" type="number" step="0.01" min={0} value={numberFormat(v('markup'))} onChange={(e) => onChangeField(row.country_id, 'markup', e.target.value)} />
                      ) : (
                        <span className="settings-value">{row.markup == null ? '-' : Number(row.markup).toFixed(2)}%</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="settings-input" type="number" step="0.01" min={0} value={numberFormat(v('social_contribution_rate'))} onChange={(e) => onChangeField(row.country_id, 'social_contribution_rate', e.target.value)} />
                      ) : (
                        <span className="settings-value">{row.social_contribution_rate == null ? '-' : Number(row.social_contribution_rate).toFixed(2)}%</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="settings-actions">
                          <button className="btn btn-primary" disabled={invalid} onClick={() => saveRow(row.country_id)}>Save</button>
                          <button className="btn btn-outline" onClick={() => cancelRowEdit(row.country_id)}>Cancel</button>
                        </div>
                      ) : (
                        <button className="btn btn-secondary" onClick={() => startRowEdit(row.country_id)}>edit</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdvanceSettingsTab;
