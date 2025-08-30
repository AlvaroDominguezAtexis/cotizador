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
  working_days: number | null;
  hours_per_day: number | null;
  mng: number | null;
  markup: number | null;
  social_contribution_rate: number | null;
  non_productive_cost_of_productive_staff: number | null;
  it_production_support: number | null;
  operational_quality_costs: number | null;
  operations_management_costs: number | null;
  lean_management_costs: number | null;
};

type ParamKey = 'cpi' | 'activity_rate' | 'npt_rate' | 'it_cost' | 'working_days' | 'hours_per_day' | 'mng' | 'markup' | 'social_contribution_rate' | 'non_productive_cost_of_productive_staff' | 'it_production_support' | 'operational_quality_costs' | 'operations_management_costs' | 'lean_management_costs';


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
  const [cpiRes, arRes, nptRes, itRes, wdRes, hpdRes, mngRes, mkRes, scrRes, npcRes, itpsRes, oqcRes, omcRes, lmcRes] = await Promise.all([
          fetch(`/projects/${projectId}/countries-cpi`),
          fetch(`/projects/${projectId}/countries-activity-rate`),
          fetch(`/projects/${projectId}/countries-npt-rate`),
          fetch(`/projects/${projectId}/countries-it-cost`),
          fetch(`/projects/${projectId}/countries-working-days`),
          fetch(`/projects/${projectId}/countries-hours-per-day`),
          fetch(`/projects/${projectId}/countries-management`),
          fetch(`/projects/${projectId}/countries-markup`),
          fetch(`/projects/${projectId}/countries-social-contribution-rate`),
          fetch(`/projects/${projectId}/countries-non-productive-cost`),
  fetch(`/projects/${projectId}/countries-it-production-support`),
  fetch(`/projects/${projectId}/countries-operational-quality-costs`),
  fetch(`/projects/${projectId}/countries-operations-management-costs`),
  fetch(`/projects/${projectId}/countries-lean-management-costs`),
        ]);
        if (!cpiRes.ok) throw new Error('Error cargando CPI del proyecto');
        if (!arRes.ok) throw new Error('Error cargando Activity Rate del proyecto');
        if (!nptRes.ok) throw new Error('Error cargando NPT Rate del proyecto');
  if (!itRes.ok) throw new Error('Error cargando IT Cost del proyecto');
  if (!wdRes.ok) throw new Error('Error cargando Working Days del proyecto');
  const [cpiJson, arJson, nptJson, itJson, wdJson, hpdJson, mngJson, mkJson, scrJson, npcJson, itpsJson, oqcJson, omcJson, lmcJson] = await Promise.all([
          cpiRes.json(),
          arRes.json(),
          nptRes.json(),
          itRes.json(),
          wdRes.json(),
          hpdRes.json(),
          mngRes.json(),
          mkRes.json(),
          scrRes.json(),
          npcRes.json(),
          itpsRes.json(),
          oqcRes.json(),
          omcRes.json(),
          lmcRes.json(),
        ]);

        if (cancelled) return;

        const cpiMap = new Map<number, number | null>((cpiJson || []).map((r: any) => [r.country_id, r.cpi]));
        const arMap = new Map<number, number | null>((arJson || []).map((r: any) => [r.country_id, r.activity_rate]));
        const nptMap = new Map<number, number | null>((nptJson || []).map((r: any) => [r.country_id, r.npt_rate]));
        const itMap = new Map<number, number | null>((itJson || []).map((r: any) => [r.country_id, r.it_cost]));
  const wdMap = new Map<number, number | null>((wdJson || []).map((r: any) => [r.country_id, r.working_days]));
  const hpdMap = new Map<number, number | null>((hpdJson || []).map((r: any) => [r.country_id, r.hours_per_day]));
  const mngMap = new Map<number, number | null>((mngJson || []).map((r: any) => [r.country_id, r.management_salary]));
  const mkMap = new Map<number, number | null>((mkJson || []).map((r: any) => [r.country_id, r.markup]));
  const scrMap = new Map<number, number | null>((scrJson || []).map((r: any) => [r.country_id, r.social_contribution_rate]));
  const npcMap = new Map<number, number | null>((npcJson || []).map((r: any) => [r.country_id, r.non_productive_cost_of_productive_staff]));
  const itpsMap = new Map<number, number | null>((itpsJson || []).map((r: any) => [r.country_id, r.it_production_support]));
  const oqcMap = new Map<number, number | null>((oqcJson || []).map((r: any) => [r.country_id, r.operational_quality_costs]));
  const omcMap = new Map<number, number | null>((omcJson || []).map((r: any) => [r.country_id, r.operations_management_costs]));
  const lmcMap = new Map<number, number | null>((lmcJson || []).map((r: any) => [r.country_id, r.lean_management_costs]));

        const merged: SettingsRow[] = countries
          .map((c) => ({
            country_id: c.id,
            country_name: c.name,
            cpi: cpiMap.get(c.id) ?? null,
            activity_rate: arMap.get(c.id) ?? null,
            npt_rate: nptMap.get(c.id) ?? null,
            it_cost: itMap.get(c.id) ?? null,
            working_days: wdMap.get(c.id) ?? null,
            hours_per_day: hpdMap.get(c.id) ?? null,
            mng: mngMap.get(c.id) ?? null,
            non_productive_cost_of_productive_staff: npcMap.get(c.id) ?? null,
            it_production_support: itpsMap.get(c.id) ?? null,
            operational_quality_costs: oqcMap.get(c.id) ?? null,
            operations_management_costs: omcMap.get(c.id) ?? null,
            lean_management_costs: lmcMap.get(c.id) ?? null,
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
  working_days: row.working_days ?? 0,
  hours_per_day: row.hours_per_day ?? 0,
        mng: row.mng ?? 0,
  non_productive_cost_of_productive_staff: row.non_productive_cost_of_productive_staff ?? 0,
  it_production_support: row.it_production_support ?? 0,
  operational_quality_costs: row.operational_quality_costs ?? 0,
  operations_management_costs: row.operations_management_costs ?? 0,
  lean_management_costs: row.lean_management_costs ?? 0,
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
  (['cpi', 'activity_rate', 'npt_rate', 'it_cost', 'working_days', 'hours_per_day', 'mng', 'non_productive_cost_of_productive_staff', 'it_production_support', 'operational_quality_costs', 'operations_management_costs', 'lean_management_costs', 'markup', 'social_contribution_rate'] as ParamKey[]).forEach((k) => {
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
  // premises_cost is now managed at city level; no country-level API call
      if (changes.non_productive_cost_of_productive_staff !== undefined) {
        calls.push(fetch(`/projects/${projectId}/countries-non-productive-cost/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ non_productive_cost_of_productive_staff: changes.non_productive_cost_of_productive_staff }),
        }));
      }
      if (changes.it_production_support !== undefined) {
        calls.push(fetch(`/projects/${projectId}/countries-it-production-support/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ it_production_support: changes.it_production_support }),
        }));
      }
      if (changes.operational_quality_costs !== undefined) {
        calls.push(fetch(`/projects/${projectId}/countries-operational-quality-costs/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operational_quality_costs: changes.operational_quality_costs }),
        }));
      }
      if (changes.operations_management_costs !== undefined) {
        calls.push(fetch(`/projects/${projectId}/countries-operations-management-costs/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operations_management_costs: changes.operations_management_costs }),
        }));
      }
      if (changes.lean_management_costs !== undefined) {
        calls.push(fetch(`/projects/${projectId}/countries-lean-management-costs/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lean_management_costs: changes.lean_management_costs }),
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
        calls.push(fetch(`/projects/${projectId}/countries-management/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ management_salary: changes.mng }),
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
                <th>Parameter \ Country</th>
                {rows.map(r => <th key={r.country_id}>{r.country_name}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {/* Helper to render a cell for a country/param */}
              {(
                [
                  { key: 'cpi', label: 'CPI', type: 'decimal' },
                  { key: 'activity_rate', label: 'Activity Rate', type: 'decimal' },
                  { key: 'npt_rate', label: 'NPT Rate', type: 'decimal' },
                  { key: 'it_cost', label: 'IT Cost', type: 'decimal' },
                  { key: 'working_days', label: 'Working Days', type: 'int' },
                  { key: 'hours_per_day', label: 'Hours per Day', type: 'decimal' },
                  { key: 'mng', label: '%Mng', type: 'decimal' },
                  { key: 'non_productive_cost_of_productive_staff', label: 'Non Productive Part of Productive Staff', type: 'decimal' },
                  { key: 'it_production_support', label: 'IT Production Support', type: 'decimal' },
                  { key: 'operational_quality_costs', label: 'Operational Quality Costs', type: 'decimal' },
                  { key: 'operations_management_costs', label: 'Operations Management Costs', type: 'decimal' },
                  { key: 'lean_management_costs', label: 'Lean Management Costs', type: 'decimal' },
                  { key: 'markup', label: 'Markup', type: 'decimal' },
                  { key: 'social_contribution_rate', label: 'Social Contribution Rate', type: 'decimal' },
                ] as Array<{ key: ParamKey; label: string; type: 'decimal' | 'int' }>
              ).map((param) => {
                return (
                  <tr key={param.key}>
                    <td><strong>{param.label}</strong></td>
                    {rows.map((row) => {
                      const draft = dirty[row.country_id] || {};
                      const isEditing = editingRow === row.country_id;
                      const v = (k: ParamKey) => (draft[k] !== undefined ? (draft[k] as number) : (row[k] ?? 0));
                      const showValue = () => {
                        const val = row[param.key as ParamKey];
                        if (val == null) return '-';
                        if (param.type === 'int') return Number(val).toFixed(0);
                        if (param.key === 'mng' || param.key === 'markup' || param.key === 'social_contribution_rate') return `${Number(val).toFixed(2)}%`;
                        return Number(val).toFixed(param.type === 'decimal' ? 2 : 0);
                      };
                      return (
                        <td key={row.country_id}>
                          {isEditing ? (
                            <input
                              className="settings-input"
                              type="number"
                              step={param.type === 'int' ? '1' : '0.01'}
                              min={0}
                              value={numberFormat(v(param.key))}
                              onChange={(e) => onChangeField(row.country_id, param.key, e.target.value)}
                            />
                          ) : (
                            <span className="settings-value">{showValue()}</span>
                          )}
                        </td>
                      );
                    })}
                    <td>
                      {/* show edit/save for the first country cell only to avoid repetition; user edits are per-country via the country header buttons below */}
                      {/* We'll render controls in a separate last row */}
                    </td>
                  </tr>
                );
              })}

              {/* Action row with per-country edit buttons */}
              <tr>
                <td></td>
                {rows.map((row) => {
                  const draft = dirty[row.country_id] || {};
                  const invalid = Object.values(draft).some(v => v == null || isNaN(Number(v)));
                  const isEditing = editingRow === row.country_id;
                  return (
                    <td key={row.country_id}>
                      {isEditing ? (
                        <div className="settings-actions">
                          <button className="btn btn-primary" disabled={invalid} onClick={() => saveRow(row.country_id)}>Save</button>
                          <button className="btn btn-outline" onClick={() => cancelRowEdit(row.country_id)}>Cancel</button>
                        </div>
                      ) : (
                        <button className="btn btn-secondary" onClick={() => startRowEdit(row.country_id)}>edit</button>
                      )}
                    </td>
                  );
                })}
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdvanceSettingsTab;
