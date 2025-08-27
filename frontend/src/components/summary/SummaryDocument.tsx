// src/components/summary/SummaryDocument.tsx
import React, { useEffect, useMemo, useState } from "react";
// Removed chart imports
import "./Summary.css";

/**
 * ============================
 *   Tipos y utilidades
 * ============================
 */

export type Allocation = {
  hours: number;
  country?: string | null;
  year?: number | string | null;
  profileType?: string | null;
  step?: string | null;
  deliverable?: string | null;
  workPackage?: string | null;
};

type WorkPackageLite = { dm?: number | string | null };

type CostsInput = {
  /** Ingresos (TO: Turnover) del proyecto */
  revenue?: number; // TO total
  /** Costes totales de personal (si ya vienen agregados) */
  personnel?: number;
  /** Otros costes (viajes, subcontrata, IT, etc.) */
  nonPersonnel?: number;
};

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

/** Convención solicitada: FTE = horasTotales / 1600 */
export const computeFTE = (totalHours: number) => totalHours / 1600;

const round = (v: number, d = 2) => Number(v.toFixed(d));

/** Agrega horas y convierte a FTE por una clave */
function aggregateFTE<T extends Allocation>(rows: T[], key: keyof Allocation) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const kRaw = r[key];
    const k =
      kRaw === undefined || kRaw === null || kRaw === ""
        ? "(N/D)"
        : String(kRaw);
    map.set(k, (map.get(k) || 0) + (r.hours || 0));
  }
  return Array.from(map.entries())
    .map(([name, hours]) => ({ name, hours, fte: round(computeFTE(hours)) }))
    .sort((a, b) => b.fte - a.fte);
}

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

  const [rows, setRows] = useState<Allocation[] | null>(allocations ?? null);
  const [summary, setSummary] = useState<AllocationSummary | null>(null);
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
    return (rows ?? []).reduce((acc, r) => acc + (Number(r.hours) || 0), 0);
  }, [rows, totalHoursOverride]);

  const totalFTEs = useMemo(() => summary?.totalFTE ?? 0, [summary]);

  // DM desde workPackages
  const dm = useMemo(() => {
    return (workPackages ?? []).reduce((acc, wp) => acc + (Number(wp?.dm) || 0), 0);
  }, [workPackages]);

  /**
   * KPIs económicos básicos (derivados por si no llegan precomputados):
   * - hourlyPriceCalc = revenue / totalHours
   * - hourlyCostCalc  = costTotal / totalHours
   * - GM = (revenue - costTotal) / revenue
   */
  const { revenue, costTotal, hourlyPriceCalc, hourlyCostCalc, gm } = useMemo(() => {
    const hasHours = totalHours > 0;

    const revenueInput =
      costs?.revenue ??
      (hourlyPrice && hasHours ? hourlyPrice * totalHours : undefined);

    const personnel = costs?.personnel ?? 0;
    const nonPersonnel = costs?.nonPersonnel ?? 0;

    const costInput =
      personnel + nonPersonnel > 0
        ? personnel + nonPersonnel
        : (hourlyCost && hasHours ? hourlyCost * totalHours : undefined);

    const hp = hasHours && revenueInput != null ? revenueInput / totalHours : undefined;
    const hc = hasHours && costInput != null ? costInput / totalHours : undefined;

    const gmVal =
      revenueInput != null && costInput != null && revenueInput !== 0
        ? (revenueInput - costInput) / revenueInput
        : undefined;

    return {
      revenue: revenueInput ?? 0,
      costTotal: costInput ?? 0,
      hourlyPriceCalc: hp ?? 0,
      hourlyCostCalc: hc ?? 0,
      gm: gmVal ?? 0,
    };
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
            <span className="summary-card-item-label kpi-label">TO Total</span>
            <span className="summary-card-item-value kpi-value emph">
              {revenue.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
            </span>
          </div>
          <div className="summary-card-item kpi-item">
            <span className="summary-card-item-label kpi-label">Hourly Cost</span>
            <span className="summary-card-item-value kpi-value">
              {hourlyCostCalc
                ? `${hourlyCostCalc.toLocaleString("es-ES", {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 2,
                  })}/h`
                : "-"}
            </span>
          </div>
          <div className="summary-card-item kpi-item">
            <span className="summary-card-item-label kpi-label">Hourly Price</span>
            <span className="summary-card-item-value kpi-value">
              {hourlyPriceCalc
                ? `${hourlyPriceCalc.toLocaleString("es-ES", {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 2,
                  })}/h`
                : "-"}
            </span>
          </div>
          <div className="summary-card-item kpi-item">
            <span className="summary-card-item-label kpi-label">GM</span>
            <span className={`summary-card-item-value kpi-value gm ${gm >= 0.0 ? "pos" : "neg"}`}>
              {`${(gm * 100).toFixed(1)}%`}
            </span>
          </div>
          <div className="summary-card-item kpi-item">
            <span className="summary-card-item-label kpi-label">DM</span>
            <span className="summary-card-item-value kpi-value">
              {dm.toLocaleString("es-ES", { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="summary-card-item kpi-item">
            <span className="summary-card-item-label kpi-label">Total FTEs</span>
            <span className="summary-card-item-value kpi-value">
              {totalFTEs.toLocaleString("es-ES")}
            </span>
          </div>
        </div>
      </div>

      {/* ===================== */}
      {/*   Dashboards detalle  */}
      {/* ===================== */}
      <div className="summary-card dash-card">
        <div className="summary-card-header dash-header">
          <h3>FTEs Breakdown</h3>
          <div className="tabs">
            <button className={`tab ${tab === "country" ? "active" : ""}`} onClick={() => setTab("country")}>
              País
            </button>
            <button className={`tab ${tab === "profileType" ? "active" : ""}`} onClick={() => setTab("profileType")}>
              Tipo perfil
            </button>
            <button className={`tab ${tab === "deliverable" ? "active" : ""}`} onClick={() => setTab("deliverable")}>
              Deliverable
            </button>
            <button className={`tab ${tab === "workPackage" ? "active" : ""}`} onClick={() => setTab("workPackage")}>
              WP
            </button>
          </div>
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
