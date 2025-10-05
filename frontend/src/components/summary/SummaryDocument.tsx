// src/components/summary/SummaryDocument.tsx
import React, { useEffect, useMemo, useState } from "react";
// Removed chart imports
import "./Summary.css";
import {
  Allocation,
  WorkPackageLite,
  CostsInput,
  FinancialKPIs,
  computeFTE,
  calculateTotalHours,
  aggregateFTE,
  calculateFinancialKPIs,
  calculateTotalDM,
  calculateProjectKPIs,
  calculateHourlyCost,
  round
} from "../../utils/functions";

type Props = {
  /** Puedes pasar el objeto proyecto o sólo su id; si hay ambos, prevalece projectId */
  project?: any;
  projectId?: string | number;

  /** Asignaciones/hours. Si no se pasan, se hace fetch con projectId/effectiveProjectId. */
  allocations?: Allocation[];

  /** Costes e ingresos (para KPIs económicos). Todo opcional. */
  costs?: CostsInput;

  /** Paquetes de trabajo para sumar DM */
  workPackages?: WorkPackageLite[];

  /** Admite profiles para compatibilidad con el uso actual (aunque no se usan aquí) */
  profiles?: any[];

  /**
   * Overrides opcionales si quieres forzar el cálculo sin depender de costs:
   * Si hourlyPrice está presente y no hay costs.revenue, se usa: revenue = hourlyPrice * totalHours
   * Si hourlyCost está presente y no hay costs.personnel/nonPersonnel, se usa: costTotal = hourlyCost * totalHours
   */
  hourlyPrice?: number;
  hourlyCost?: number;

  /** Si lo tienes precomputado, puedes inyectar total de horas. Si no, se suma de allocations. */
  totalHoursOverride?: number;
};

/**
 * ============================
 *   Capa de datos (fetch opcional)
 * ============================
 */
interface AllocationSummary {
  totalFTE: number;
  byWorkpackage: { name: string; fte: number }[];
  byDeliverable: { name: string; fte: number }[];
  byCountry: { name: string; fte: number }[];
  byProfile: { name: string; fte: number }[];
}

async function fetchAllocationSummary(projectId: string | number): Promise<AllocationSummary> {
  const res = await fetch(`/projects/${projectId}/allocations/summary`);
  if (!res.ok) throw new Error(`No se pudo cargar el resumen de allocations (${res.status})`);
  return await res.json();
}

async function fetchAllocations(projectId: string | number): Promise<Allocation[]> {
  // Usa el proxy del frontend hacia el backend: /projects/:id/allocations
  const res = await fetch(`/projects/${projectId}/allocations`);
  if (!res.ok) throw new Error(`No se pudo cargar allocations (${res.status})`);
  const raw = await res.json();
  return (raw as any[]).map((r) => ({
    // Sumamos horas desde steps.process_time cuando esté disponible
    hours: Number(r?.process_time ?? r?.hours ?? r?.totalHours ?? 0),
    // Preferimos nombres si el backend los expone; si no, caemos a ids/alternativos
    country: r?.country_name ?? r?.country ?? null,
    year: r?.year ?? (r?.date ? new Date(r.date).getFullYear() : null),
    profileType: r?.profile_name ?? r?.profileType ?? r?.profile_type ?? null,
    step: r?.step_name ?? r?.step ?? r?.stepName ?? null,
    deliverable: r?.deliverable_name ?? r?.deliverable ?? r?.deliverableName ?? r?.name ?? null,
    workPackage: r?.workpackage_name ?? r?.workpackage ?? r?.wp ?? r?.workPackageName ?? null,
  }));
}

/**
 * ============================
 *   Componente principal
 * ============================
 */
const SummaryDocument: React.FC<Props> = ({
  project,
  projectId,
  allocations,
  costs,
  workPackages,
  profiles, // compat
  hourlyPrice,
  hourlyCost,
  totalHoursOverride,
}) => {
  // Permite pasar project o projectId; si ambos existen, prevalece projectId
  const effectiveProjectId = projectId ?? project?.id ?? project?.projectId ?? undefined;
  
  // Extraer el IQP del proyecto para determinar si es IQP 1-2 (solo workpackages, sin deliverables)
  const projectIqp = project?.iqp || 1;
  const isIqp12 = projectIqp === 1 || projectIqp === 2;

  const [rows, setRows] = useState<Allocation[] | null>(allocations ?? null);
  const [summary, setSummary] = useState<AllocationSummary | null>(null);
  const [operationalRevenue, setOperationalRevenue] = useState<number | null>(null);
  const [hourlyPriceRemote, setHourlyPriceRemote] = useState<number | null>(null);
  const [hourlyCostsRemote, setHourlyCostsRemote] = useState<number | null>(null);
  const [projectGMBSRemote, setProjectGMBSRemote] = useState<number | null>(null);
  const [projectDMRemote, setProjectDMRemote] = useState<number | null>(null);
  const [financialBreakdown, setFinancialBreakdown] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(!allocations && !!effectiveProjectId);
  const [tab, setTab] = useState<
    "country" | "profileType" | "deliverable" | "workPackage"
  >("country");

  // Fetch allocations and summary if not provided
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (effectiveProjectId == null) return;
      try {
        setLoading(true);
        const [allocData, summaryData] = await Promise.all([
          !rows ? fetchAllocations(effectiveProjectId) : Promise.resolve(null),
          fetchAllocationSummary(effectiveProjectId)
        ]);
        
        if (!cancelled) {
          if (allocData) setRows(allocData);
          setSummary(summaryData);
          // fetch operational revenue (sum of operational_to in deliverable_yearly_quantities)
          try {
            const rr = await fetch(`/projects/${effectiveProjectId}/operational-revenue`);
            if (rr.ok) {
              const j = await rr.json();
              setOperationalRevenue(Number(j.operationalRevenue || 0));
            } else {
              console.warn('Could not fetch operational revenue', rr.status);
              setOperationalRevenue(null);
            }
          } catch (e) {
            console.error('Error fetching operational revenue', e);
            setOperationalRevenue(null);
          }
          // fetch hourly price
          try {
            const hp = await fetch(`/projects/${effectiveProjectId}/hourly-price`);
            if (hp.ok) {
              const hj = await hp.json();
              setHourlyPriceRemote(Number(hj.hourlyPrice || 0));
            } else {
              console.warn('Could not fetch hourly price', hp.status);
              setHourlyPriceRemote(null);
            }
          } catch (e) {
            console.error('Error fetching hourly price', e);
            setHourlyPriceRemote(null);
          }
          // fetch deliverables costs -> to compute Hourly Costs = totalCosts / totalHours
          try {
            const cc = await fetch(`/projects/${effectiveProjectId}/deliverables-costs`);
            if (cc.ok) {
              const cj = await cc.json();
              const totalCosts = Number(cj.totalCosts || 0);
              const projectDM = cj.projectDM !== undefined ? Number(cj.projectDM) : null;
              if (projectDM !== null) setProjectDMRemote(projectDM);
              const projectGMBS = cj.projectGMBS !== undefined ? Number(cj.projectGMBS) : null;
              if (projectGMBS !== null) setProjectGMBSRemote(projectGMBS);
              // compute hourlyCosts: prefer totalHoursOverride, then allocData (fresh), then rows state
              const hoursSource = typeof totalHoursOverride === 'number' ? totalHoursOverride : (allocData ?? rows ?? []);
              const hours = typeof hoursSource === 'number' ? hoursSource : calculateTotalHours(hoursSource as Allocation[]);
              const hourlyCostVal = calculateHourlyCost(totalCosts, hours);
              setHourlyCostsRemote(hourlyCostVal);
            } else {
              console.warn('Could not fetch deliverables costs', cc.status);
              setHourlyCostsRemote(null);
            }
          } catch (e) {
            console.error('Error fetching deliverables costs', e);
            setHourlyCostsRemote(null);
          }

            // fetch financial breakdown per workpackage/deliverable
            try {
              const fb = await fetch(`/projects/${effectiveProjectId}/deliverables-costs-breakdown`);
              if (fb.ok) {
                const fj = await fb.json();
                setFinancialBreakdown(Array.isArray(fj.workPackages) ? fj.workPackages : (fj.workPackages || []));
              } else {
                console.warn('Could not fetch financial breakdown', fb.status);
                setFinancialBreakdown(null);
              }
            } catch (e) {
              console.error('Error fetching financial breakdown', e);
              setFinancialBreakdown(null);
            }
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          if (!rows) setRows([]);
          setSummary(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [effectiveProjectId]);

  // Total horas y FTEs desde steps.process_time
  const totalHours = useMemo(() => {
    if (typeof totalHoursOverride === "number") return totalHoursOverride;
    return calculateTotalHours(rows ?? []);
  }, [rows, totalHoursOverride]);

  const totalFTEs = useMemo(() => summary?.totalFTE ?? 0, [summary]);

  // DM desde workPackages
  const dm = useMemo(() => {
    return calculateTotalDM(workPackages ?? []);
  }, [workPackages]);

  /**
   * KPIs económicos básicos (derivados por si no llegan precomputados):
   * - hourlyPriceCalc = revenue / totalHours
   * - hourlyCostCalc  = costTotal / totalHours
   * - GM = (revenue - costTotal) / revenue
   */
  const { revenue, costTotal, hourlyPriceCalc, hourlyCostCalc, gm } = useMemo(() => {
    return calculateFinancialKPIs({
      costs,
      totalHours,
      hourlyPrice,
      hourlyCost
    });
  }, [costs, hourlyPrice, hourlyCost, totalHours]);

  /** Datos para dashboards de FTEs */
  const currentSummaryData = useMemo(() => {
    if (!summary) return [];

    const getDataForTab = (tab: string) => {
      switch (tab) {
        case "country":
          return summary.byCountry;
        case "profileType":
          return summary.byProfile;
        case "deliverable":
          return summary.byDeliverable;
        case "workPackage":
          return summary.byWorkpackage;
        default:
          return [];
      }
    };

    return getDataForTab(tab).map(item => ({
      name: item.name,
      hours: item.fte * 1600, // Convert back to hours for display
      fte: item.fte
    }));
  }, [summary, tab]);

  // The currentData is now managed by currentSummaryData

  return (
    <div className="summary-wrapper">
      {/* ===================== */}
      {/*   Summary Detail      */}
      {/* ===================== */}
      <div className="summary-card kpi-card">
        <div className="summary-card-header kpi-header">
          <h2>Summary Detail</h2>
          {loading && <span className="tag subtle">Cargando horas…</span>}
        </div>

        <div className="kpi-grid">
          <div className="summary-card-item kpi-item">
            <span className="summary-card-item-label kpi-label">Operational Turnover</span>
            <span className="summary-card-item-value kpi-value emph">
              {(operationalRevenue ?? revenue ?? 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
            </span>
          </div>
          <div className="summary-card-item kpi-item">
            <span className="summary-card-item-label kpi-label">DM</span>
            <span className="summary-card-item-value kpi-value">
              {(projectDMRemote != null ? projectDMRemote : dm).toLocaleString("es-ES", { maximumFractionDigits: 2 })}%
            </span>
          </div>
          <div className="summary-card-item kpi-item">
            <span className="summary-card-item-label kpi-label">GMBS</span>
            <span className={`summary-card-item-value kpi-value gm ${(projectGMBSRemote ?? (gm * 100)) >= 0.0 ? "pos" : "neg"} ${projectGMBSRemote != null ? 'black' : ''}`}>
              {`${((projectGMBSRemote != null) ? projectGMBSRemote : (gm * 100)).toFixed(1)}%`}
            </span>
          </div>
          <div className="summary-card-item kpi-item">
            <span className="summary-card-item-label kpi-label">Hourly Price</span>
            <span className="summary-card-item-value kpi-value">
              {(hourlyPriceRemote ?? hourlyPriceCalc)
                ? `${(hourlyPriceRemote ?? hourlyPriceCalc).toLocaleString("es-ES", {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 2,
                  })}/h`
                : "-"}
            </span>
          </div>
          <div className="summary-card-item kpi-item">
            <span className="summary-card-item-label kpi-label">GMBS in €</span>
            <span className="summary-card-item-value kpi-value">
              {(() => {
                const operationalTO = operationalRevenue ?? revenue ?? 0;
                const gmbsPercentage = projectGMBSRemote != null ? projectGMBSRemote : (gm * 100);
                const gmbsInEuros = operationalTO * gmbsPercentage / 100;
                return gmbsInEuros.toLocaleString("es-ES", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 2,
                });
              })()}
            </span>
          </div>
          <div className="summary-card-item kpi-item">
            <span className="summary-card-item-label kpi-label">Total FTEs</span>
            <span className="summary-card-item-value kpi-value">
              {totalFTEs.toLocaleString("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}
            </span>
          </div>
        </div>
      </div>

      {/* ===================== */}
      {/*   Main financial information */}
      <div className="summary-card financial-card">
        <div className="summary-card-header dash-header">
          <h3>Main financial information</h3>
        </div>

        {financialBreakdown == null ? (
          <div className="summary-hint empty">No hay información financiera disponible.</div>
        ) : (
          <div className="financial-table">
            {financialBreakdown.map((wp: any) => (
              <div className="wp-row" key={wp.id}>
                <div className="wp-grid">
                  <div className="wp-grid-title">
                    <div className="wp-grid-label">Workpackage</div>
                    <strong>{wp.nombre}</strong>
                  </div>

                  <div className="wp-grid-cell">
                    <div className="wp-grid-label">Hourly Price</div>
                    <div className="wp-grid-value">{(wp.totals.hourlyPrice || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}/h</div>
                  </div>

                  <div className="wp-grid-cell">
                    <div className="wp-grid-label">Operational TO</div>
                    <div className="wp-grid-value">{(wp.totals.totalTO || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                  </div>

                  <div className="wp-grid-cell">
                    <div className="wp-grid-label">GM</div>
                    <div className="wp-grid-value">{(wp.totals.dm || 0).toFixed(1)}%</div>
                  </div>

                  <div className="wp-grid-cell">
                    <div className="wp-grid-label">DM</div>
                    <div className="wp-grid-value">{(wp.totals.totalCosts || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                  </div>

                  {/* Solo mostrar toggle y deliverables para IQP 3-5 */}
                  {!isIqp12 && (
                    <div className="wp-grid-toggle">
                      <button aria-expanded="false" aria-controls={`wp-del-${wp.id}`} title="Expandir deliverables" className="btn small toggle" onClick={(e) => {
                        const el = document.getElementById(`wp-del-${wp.id}`);
                        if (el) el.classList.toggle('expanded');
                        const btn = e.currentTarget as HTMLButtonElement;
                        btn.setAttribute('aria-expanded', String(el ? el.classList.contains('expanded') : false));
                      }}>▾</button>
                    </div>
                  )}
                </div>

                {/* Solo mostrar lista de deliverables para IQP 3-5 */}
                {!isIqp12 && (
                  <div id={`wp-del-${wp.id}`} className="deliverables-list">
                    <div className="table-mini-head">
                      <span>Deliverable</span>
                      <span>Hourly Price</span>
                      <span>Operational TO</span>
                      <span>GM</span>
                      <span>DM</span>
                    </div>
                    {(wp.deliverables || []).map((d: any) => (
                      <div className="table-mini-row" key={d.id}>
                        <span title={d.nombre}>{d.nombre}</span>
                        <span>{(d.hourlyPrice || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}/h</span>
                        <span>{(d.totalTO || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                        <span>{(d.dm || 0).toFixed(1)}%</span>
                        <span>{(d.totalCosts || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===================== */}
      {/*   FTE detailed breakdown */}
      <div className="summary-card financial-card">
        <div className="summary-card-header dash-header">
          <h3>FTE detailed breakdown</h3>
        </div>

        {currentSummaryData.length === 0 ? (
          <div className="summary-hint empty">Sin datos para esta dimensión.</div>
        ) : (
          <div className="table-mini">
            <div className="table-mini-head">
              <span>Grupo</span>
              <span>Horas</span>
              <span>FTE</span>
            </div>
            {currentSummaryData.map((r: { name: string; hours: number; fte: number }) => (
              <div className="table-mini-row" key={r.name}>
                <span title={r.name}>{r.name}</span>
                <span>{r.hours.toLocaleString("es-ES")}</span>
                <span>{r.fte.toLocaleString("es-ES", { maximumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryDocument;
