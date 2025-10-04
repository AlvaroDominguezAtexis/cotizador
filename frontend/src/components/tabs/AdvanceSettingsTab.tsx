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
  holidays: number | null;
  total_days: number | null;
  working_days: number | null;
  hours_per_day: number | null;
  markup: number | null;
  social_contribution_rate: number | null;
};

type ParamKey = 'cpi' | 'activity_rate' | 'npt_rate' | 'it_cost' | 'holidays' | 'total_days' | 'working_days' | 'hours_per_day' | 'markup' | 'social_contribution_rate';


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
  const [spainAlert, setSpainAlert] = useState<boolean>(false);

  // Load per-parameter values and merge into a single table
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [cpiRes, arRes, nptRes, itRes, holidaysRes, totalDaysRes, wdRes, hpdRes, mkRes, scrRes] = await Promise.all([
          fetch(`/projects/${projectId}/countries-cpi`),
          fetch(`/projects/${projectId}/countries-activity-rate`),
          fetch(`/projects/${projectId}/countries-npt-rate`),
          fetch(`/projects/${projectId}/countries-it-cost`),
          fetch(`/projects/${projectId}/countries-holidays`),
          fetch(`/projects/${projectId}/countries-total-days`),
          fetch(`/projects/${projectId}/countries-working-days`),
          fetch(`/projects/${projectId}/countries-hours-per-day`),
          fetch(`/projects/${projectId}/countries-markup`),
          fetch(`/projects/${projectId}/countries-social-contribution-rate`),
        ]);
        if (!cpiRes.ok) throw new Error('Error cargando CPI del proyecto');
        if (!arRes.ok) throw new Error('Error cargando Activity Rate del proyecto');
        if (!nptRes.ok) throw new Error('Error cargando NPT Rate del proyecto');
        if (!itRes.ok) throw new Error('Error cargando IT Cost del proyecto');
        if (!holidaysRes.ok) throw new Error('Error cargando Holidays del proyecto');
        if (!totalDaysRes.ok) throw new Error('Error cargando Total Days del proyecto');
        if (!wdRes.ok) throw new Error('Error cargando Working Days del proyecto');
        const [cpiJson, arJson, nptJson, itJson, holidaysJson, totalDaysJson, wdJson, hpdJson, mkJson, scrJson] = await Promise.all([
          cpiRes.json(),
          arRes.json(),
          nptRes.json(),
          itRes.json(),
          holidaysRes.json(),
          totalDaysRes.json(),
          wdRes.json(),
          hpdRes.json(),
          mkRes.json(),
          scrRes.json(),
        ]);        if (cancelled) return;

        const cpiMap = new Map<number, number | null>((cpiJson || []).map((r: any) => [r.country_id, r.cpi]));
        const arMap = new Map<number, number | null>((arJson || []).map((r: any) => [r.country_id, r.activity_rate]));
        const nptMap = new Map<number, number | null>((nptJson || []).map((r: any) => [r.country_id, r.npt_rate]));
        const itMap = new Map<number, number | null>((itJson || []).map((r: any) => [r.country_id, r.it_cost]));
        const holidaysMap = new Map<number, number | null>((holidaysJson || []).map((r: any) => [r.country_id, r.holidays]));
        const totalDaysMap = new Map<number, number | null>((totalDaysJson || []).map((r: any) => [r.country_id, r.total_days]));
        const wdMap = new Map<number, number | null>((wdJson || []).map((r: any) => [r.country_id, r.working_days]));
        const hpdMap = new Map<number, number | null>((hpdJson || []).map((r: any) => [r.country_id, r.hours_per_day]));
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
            holidays: holidaysMap.get(c.id) ?? null,
            total_days: totalDaysMap.get(c.id) ?? null,
            working_days: wdMap.get(c.id) ?? null,
            hours_per_day: hpdMap.get(c.id) ?? null,
            // mng removed from Advance Settings
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
        holidays: row.holidays ?? 0,
        total_days: row.total_days ?? 0,
        working_days: row.working_days ?? 0,
        hours_per_day: row.hours_per_day ?? 0,
        // mng removed from Advance Settings
        markup: row.markup ?? 0,
        social_contribution_rate: row.social_contribution_rate ?? 0,
      },
    }));
  };

  const cancelRowEdit = (countryId: number) => {
    setEditingRow(curr => (curr === countryId ? null : curr));
    setDirty(prev => { const p = { ...prev }; delete p[countryId]; return p; });
  };

  // Calculate working_days in real time based on holidays and total_days
  const calculateWorkingDays = (countryId: number, draft: Partial<Record<ParamKey, number>>, row: SettingsRow) => {
    const totalDays = draft.total_days !== undefined ? draft.total_days : (row.total_days ?? 0);
    const holidays = draft.holidays !== undefined ? draft.holidays : (row.holidays ?? 0);
    let workingDays = totalDays - holidays;
    
    // Apply Spain limit (country id = 1)
    if (countryId === 1 && workingDays > 216) {
      workingDays = 216;
    }
    
    return workingDays;
  };

  const onChangeField = (countryId: number, key: ParamKey, val: string) => {
    const parsed = Number(val);
    const newDirty = {
      ...dirty,
      [countryId]: {
        ...(dirty[countryId] || {}),
        [key]: isNaN(parsed) || parsed < 0 ? NaN : parsed,
      },
    };

    // Check if this change affects working_days calculation for Spain
    if (countryId === 1 && (key === 'holidays' || key === 'total_days')) {
      const row = rowsById.get(countryId);
      if (row) {
        const totalDays = key === 'total_days' ? parsed : (newDirty[countryId]?.total_days ?? row.total_days ?? 0);
        const holidays = key === 'holidays' ? parsed : (newDirty[countryId]?.holidays ?? row.holidays ?? 0);
        
        // Calculate the working days without Spain's limit
        const calculatedWorkingDays = totalDays - holidays;
        
        // Show warning only if the calculated value (without limit) would be > 216
        if (!isNaN(totalDays) && !isNaN(holidays) && totalDays >= 0 && holidays >= 0 && calculatedWorkingDays > 216) {
          setSpainAlert(true);
          setTimeout(() => setSpainAlert(false), 3000); // Hide alert after 3 seconds
        }
      }
    }

    setDirty(newDirty);
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
  (['cpi', 'activity_rate', 'npt_rate', 'it_cost', 'holidays', 'total_days', 'working_days', 'hours_per_day', 'markup', 'social_contribution_rate'] as ParamKey[]).forEach((k) => {
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
      if (changes.holidays !== undefined) {
        calls.push(fetch(`/projects/${projectId}/countries-holidays/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ holidays: changes.holidays }),
        }));
      }
      if (changes.total_days !== undefined) {
        calls.push(fetch(`/projects/${projectId}/countries-total-days/${countryId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ total_days: changes.total_days }),
        }));
      }
  // premises_cost is now managed at city level; no country-level API call

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
  // mng editing removed from Advance Settings
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

      // Apply changes locally and recalculate working_days if needed
      setRows(prev => prev.map(r => {
        if (r.country_id === countryId) {
          const updatedRow = { ...r, ...changes };
          
          // If holidays or total_days changed, recalculate working_days
          if (changes.holidays !== undefined || changes.total_days !== undefined) {
            const totalDays = updatedRow.total_days ?? 0;
            const holidays = updatedRow.holidays ?? 0;
            let workingDays = totalDays - holidays;
            
            // Apply Spain limit (country id = 1)
            if (countryId === 1 && workingDays > 216) {
              workingDays = 216;
            }
            
            updatedRow.working_days = workingDays;
          }
          
          return updatedRow;
        }
        return r;
      }));
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
      {spainAlert && (
        <div className="spain-alert">
          ⚠️ El cálculo excede 216 días. Para España, los días laborables se limitarán automáticamente a 216.
        </div>
      )}
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
                  { key: 'holidays', label: 'Holidays', type: 'int' },
                  { key: 'total_days', label: 'Total Days', type: 'int' },
                  { key: 'working_days', label: 'Working Days (Calculated)', type: 'int', readonly: true },
                  { key: 'hours_per_day', label: 'Hours per Day', type: 'decimal' },
                  // %Mng removed from Advance Settings
                  { key: 'markup', label: 'Markup', type: 'decimal' },
                  { key: 'social_contribution_rate', label: 'Social Contribution Rate', type: 'decimal' },
                ] as Array<{ key: ParamKey; label: string; type: 'decimal' | 'int'; readonly?: boolean }>
              ).map((param) => {
                return (
                  <tr key={param.key}>
                    <td><strong>{param.label}</strong></td>
                    {rows.map((row) => {
                      const draft = dirty[row.country_id] || {};
                      const isEditing = editingRow === row.country_id;
                      const v = (k: ParamKey) => (draft[k] !== undefined ? (draft[k] as number) : (row[k] ?? 0));
                      const showValue = () => {
                        // For working_days, always show real-time calculation if we have draft values
                        if (param.key === 'working_days') {
                          const hasDraftValues = draft.holidays !== undefined || draft.total_days !== undefined;
                          if (isEditing && hasDraftValues) {
                            const calculatedWorkingDays = calculateWorkingDays(row.country_id, draft, row);
                            return calculatedWorkingDays.toFixed(0);
                          }
                        }
                        
                        const val = row[param.key as ParamKey];
                        if (val == null) return '-';
                        if (param.type === 'int') return Number(val).toFixed(0);
                        if (param.key === 'markup' || param.key === 'social_contribution_rate') return `${Number(val).toFixed(2)}%`;
                        return Number(val).toFixed(param.type === 'decimal' ? 2 : 0);
                      };
                      return (
                        <td key={row.country_id}>
                          {isEditing && !param.readonly ? (
                            <input
                              className="settings-input"
                              type="number"
                              step={param.type === 'int' ? '1' : '0.01'}
                              min={0}
                              value={numberFormat(v(param.key))}
                              onChange={(e) => onChangeField(row.country_id, param.key, e.target.value)}
                            />
                          ) : (
                            <span className={`settings-value ${param.readonly ? 'readonly' : ''}`}>
                              {showValue()}
                              {param.readonly && isEditing && (
                                <small style={{display: 'block', fontSize: '0.8em', color: '#666'}}>
                                  (Auto-calculated)
                                </small>
                              )}
                            </span>
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
