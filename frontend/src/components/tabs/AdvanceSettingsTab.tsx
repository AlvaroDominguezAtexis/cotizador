// src/components/tabs/AdvanceSettingsTab.tsx
import React, { useEffect, useMemo, useState } from 'react';
import './Tabs.css';

type Country = { id: number; name: string };

type ProjectCountryCpi = {
  country_id: number;
  country_name: string;
  cpi: number | null;
};

interface Props {
  projectId: number | string;
  countries: Country[]; // Only the project's countries
}

const numberFormat = (n: number | null | undefined) =>
  n == null || isNaN(Number(n)) ? '' : String(Number(n));

export const AdvanceSettingsTab: React.FC<Props> = ({ projectId, countries }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ProjectCountryCpi[]>([]);
  const [dirty, setDirty] = useState<Record<number, number>>({}); // country_id -> cpi
  const [editing, setEditing] = useState<number | null>(null); // country_id currently in edit

  // Load countries for labeling and project CPI values
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
  const cpiRes = await fetch(`/projects/${projectId}/countries-cpi`);
  if (!cpiRes.ok) throw new Error('Error cargando CPI del proyecto');
  const cpiJson = await cpiRes.json();

        if (cancelled) return;
        setRows(cpiJson || []);
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

  // Compute which countries are in the project but missing CPI rows
  const byId = useMemo(() => new Map(rows.map(r => [r.country_id, r] as const)), [rows]);

  const handleChange = (countryId: number, val: string) => {
    const parsed = Number(val);
    if (isNaN(parsed) || parsed < 0) {
      setDirty(prev => ({ ...prev, [countryId]: NaN }));
      return;
    }
    setDirty(prev => ({ ...prev, [countryId]: parsed }));
  };

  const handleSave = async (countryId: number) => {
    const value = dirty[countryId];
    if (value == null || isNaN(Number(value))) return;
    try {
      const res = await fetch(`/projects/${projectId}/countries-cpi/${countryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpi: value }),
      });
      if (!res.ok) throw new Error('Error guardando CPI');
      const saved = await res.json();
      setRows(prev => {
        const next = prev.filter(r => r.country_id !== countryId);
    next.push({ country_id: countryId, country_name: countries.find(c => c.id === countryId)?.name || String(countryId), cpi: saved.cpi });
        return next.sort((a,b) => a.country_name.localeCompare(b.country_name));
      });
      setDirty(prev => { const p = { ...prev }; delete p[countryId]; return p; });
      setEditing(null);
    } catch (e) {
      console.error(e);
      // keep dirty for retry
    }
  };

  const startEdit = (countryId: number, currentCpi: number | null) => {
    setEditing(countryId);
    setDirty(prev => ({ ...prev, [countryId]: currentCpi ?? 0 }));
  };

  const cancelEdit = (countryId: number) => {
    setEditing(curr => (curr === countryId ? null : curr));
    setDirty(prev => { const p = { ...prev }; delete p[countryId]; return p; });
  };

  if (loading) return <div className="tab-container"><div className="tab-header"><h1>Advance Setting</h1></div><div className="tab-content">Cargando…</div></div>;
  if (error) return <div className="tab-container"><div className="tab-header"><h1>Advance Setting</h1></div><div className="tab-content">{error}</div></div>;

  // Merge countries list with project rows to display all project countries (if needed, adapt based on your UI source of project countries)
  const merged = countries
    .map((c: Country) => ({
      country_id: c.id,
      country_name: c.name,
      cpi: byId.get(c.id)?.cpi ?? null,
    }))
    .sort((a: ProjectCountryCpi, b: ProjectCountryCpi) => a.country_name.localeCompare(b.country_name));

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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {merged.map((row: ProjectCountryCpi) => {
                const draft = dirty[row.country_id];
                const value = draft !== undefined ? draft : (row.cpi ?? 0);
                const invalid = draft !== undefined && isNaN(Number(draft));
                return (
                  <tr key={row.country_id} className="settings-row">
                    <td>{row.country_name}</td>
                    <td>
                      {editing === row.country_id ? (
                        <input
                          className="settings-input"
                          type="number"
                          step="0.01"
                          min={0}
                          value={numberFormat(value as number)}
                          onChange={(e) => handleChange(row.country_id, e.target.value)}
                        />
                      ) : (
                        <span className="settings-value">{row.cpi == null ? '-' : Number(row.cpi).toFixed(2)}</span>
                      )}
                    </td>
                    <td>
                      {editing === row.country_id ? (
                        <div className="settings-actions">
                          <button className="btn btn-primary" disabled={invalid} onClick={() => handleSave(row.country_id)}>Save</button>
                          <button className="btn btn-outline" onClick={() => cancelEdit(row.country_id)}>Cancel</button>
                        </div>
                      ) : (
                        <button className="btn btn-secondary" onClick={() => startEdit(row.country_id, row.cpi)}>edit</button>
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
