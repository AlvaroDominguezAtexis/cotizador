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
import { calculateMarginsSimple } from "../../utils/marginCalculations";

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
  
  // Estado temporal para los valores del Manual Unit Price mientras el usuario escribe
  const [tempUnitPrices, setTempUnitPrices] = useState<Record<number, string>>({});
  
  // Estado para los customer unit prices desde la BD
  const [customerUnitPrices, setCustomerUnitPrices] = useState<Record<number, number>>({});

  // Función para calcular TO teórico del proyecto
  const calculateTheoreticalTO = (workpackages: any[]) => {
    if (!isIqp12 || !Array.isArray(workpackages)) return null;
    
    let totalTheoreticalTO = 0;
    
    for (const wp of workpackages) {
      const unitPrice = customerUnitPrices[wp.id] || wp.totals?.customerUnitPrice || 0;
      const quantity = wp.totals?.totalQuantity || 0;
      
      if (unitPrice > 0 && quantity > 0) {
        // Usar el TO teórico (manual unit price * quantity)
        totalTheoreticalTO += unitPrice * quantity;
      } else {
        // Si no hay manual unit price, usar el TO real del workpackage
        totalTheoreticalTO += wp.totals?.totalTO || 0;
      }
    }
    
    return totalTheoreticalTO;
  };

  // Función para calcular márgenes teóricos del proyecto
  const calculateTheoreticalMargins = (workpackages: any[]) => {
    const theoreticalTO = calculateTheoreticalTO(workpackages);
    if (!theoreticalTO) return null;
    
    // Sumar todos los costos del proyecto
    let totalDmCosts = 0;
    let totalGmbsCosts = 0;
    
    for (const wp of workpackages) {
      totalDmCosts += wp.totals?.totalCosts || 0;
      totalGmbsCosts += wp.totals?.totalGmbsCosts || 0;
    }
    
    return calculateMarginsSimple({
      givenTO: theoreticalTO,
      totalDmCosts: totalDmCosts,
      totalGmbsCosts: totalGmbsCosts
    });
  };

  // Función para recalcular DM y GMBS usando TO existente
  const recalculateWorkpackageMargins = (workpackages: any[]) => {
    return workpackages.map(wp => {
      const totalTO = wp.totals?.totalTO || 0;
      const totalDmCosts = wp.totals?.totalCosts || 0;
      const totalNopCosts = wp.totals?.totalNop || 0;
      
      // Si tenemos los datos necesarios, recalcular márgenes usando la función de utilidad
      if (totalTO > 0 && wp.totals) {
        const totalGmbsCosts = totalDmCosts + totalNopCosts; // GMBS incluye costos no operacionales
        
        const recalculated = calculateMarginsSimple({
          givenTO: totalTO,
          totalDmCosts: totalDmCosts,
          totalGmbsCosts: totalGmbsCosts
        });

        console.log(`📊 Recalculated margins for WP "${wp.nombre}":`, {
          original: { DM: wp.totals.dm || 0, GMBS: wp.totals.gmbs || 0 },
          recalculated: { DM: recalculated.DM, GMBS: recalculated.GMBS },
          costs: { totalTO, totalDmCosts, totalNopCosts, totalGmbsCosts }
        });

        return {
          ...wp,
          totals: {
            ...wp.totals,
            dm: recalculated.DM,
            gmbs: recalculated.GMBS
          }
        };
      }

      // Si no se pueden recalcular, usar los valores existentes del backend
      return wp;
    });
  };

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
                const rawWorkPackages = Array.isArray(fj.workPackages) ? fj.workPackages : (fj.workPackages || []);
                // Usar directamente los valores calculados por el backend (no recalcular)
                console.log('📊 Raw workpackages from backend:', rawWorkPackages.map((wp: any) => ({
                  nombre: wp.nombre,
                  totals: {
                    totalTO: wp.totals.totalTO,
                    totalCosts: wp.totals.totalCosts,
                    totalGmbsCosts: wp.totals.totalGmbsCosts,
                    dm: wp.totals.dm,
                    gmbs: wp.totals.gmbs
                  }
                })));
                setFinancialBreakdown(rawWorkPackages);
              } else {
                console.warn('Could not fetch financial breakdown', fb.status);
                setFinancialBreakdown(null);
              }
            } catch (e) {
              console.error('Error fetching financial breakdown', e);
              setFinancialBreakdown(null);
            }

            // fetch customer unit prices existentes para poblar placeholders
            try {
              const cup = await fetch(`/projects/${effectiveProjectId}/customer-unit-prices`);
              if (cup.ok) {
                const cupj = await cup.json();
                const prices = cupj.customerUnitPrices || {};
                console.log('🏷️ Loaded existing customer unit prices:', prices);
                setCustomerUnitPrices(prices);
              } else {
                console.warn('Could not fetch customer unit prices', cup.status);
                setCustomerUnitPrices({});
              }
            } catch (e) {
              console.error('Error fetching customer unit prices', e);
              setCustomerUnitPrices({});
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
          {isIqp12 && financialBreakdown && (() => {
            const theoreticalTO = calculateTheoreticalTO(financialBreakdown);
            const realTO = operationalRevenue ?? revenue ?? 0;
            return theoreticalTO && theoreticalTO !== realTO && (
              <div className="margin-legend">
                <span className="legend-real">Real</span>
                <span className="legend-divider">|</span>
                <span className="legend-theoretical">Theoretical (Manual Unit Price)</span>
              </div>
            );
          })()}
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
              {(() => {
                const realDM = projectDMRemote != null ? projectDMRemote : dm;
                const theoreticalMargins = financialBreakdown ? calculateTheoreticalMargins(financialBreakdown) : null;
                const theoreticalTO = financialBreakdown ? calculateTheoreticalTO(financialBreakdown) : null;
                const realTO = operationalRevenue ?? revenue ?? 0;
                
                if (isIqp12 && theoreticalMargins && theoreticalTO && theoreticalTO !== realTO) {
                  return (
                    <div 
                      className="margin-comparison"
                      title={`DM Real: ${realDM.toFixed(1)}% (TO: ${realTO.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})}) vs DM Teórico: ${theoreticalMargins.DM.toFixed(1)}% (TO manual: ${theoreticalTO.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})})`}
                    >
                      <div className="margin-real">{realDM.toLocaleString("es-ES", { maximumFractionDigits: 2 })}%</div>
                      <div className="margin-divider"></div>
                      <div className="margin-theoretical">{theoreticalMargins.DM.toFixed(1)}%</div>
                    </div>
                  );
                }
                
                return `${realDM.toLocaleString("es-ES", { maximumFractionDigits: 2 })}%`;
              })()}
            </span>
          </div>
          <div className="summary-card-item kpi-item">
            <span className="summary-card-item-label kpi-label">GMBS</span>
            <span className={`summary-card-item-value kpi-value gm ${(projectGMBSRemote ?? (gm * 100)) >= 0.0 ? "pos" : "neg"} ${projectGMBSRemote != null ? 'black' : ''}`}>
              {(() => {
                const realGMBS = projectGMBSRemote != null ? projectGMBSRemote : (gm * 100);
                const theoreticalMargins = financialBreakdown ? calculateTheoreticalMargins(financialBreakdown) : null;
                const theoreticalTO = financialBreakdown ? calculateTheoreticalTO(financialBreakdown) : null;
                const realTO = operationalRevenue ?? revenue ?? 0;
                
                if (isIqp12 && theoreticalMargins && theoreticalTO && theoreticalTO !== realTO) {
                  return (
                    <div 
                      className="margin-comparison"
                      title={`GMBS Real: ${realGMBS.toFixed(1)}% (TO: ${realTO.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})}) vs GMBS Teórico: ${theoreticalMargins.GMBS.toFixed(1)}% (TO manual: ${theoreticalTO.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})})`}
                    >
                      <div className="margin-real">{realGMBS.toFixed(1)}%</div>
                      <div className="margin-divider"></div>
                      <div className="margin-theoretical">{theoreticalMargins.GMBS.toFixed(1)}%</div>
                    </div>
                  );
                }
                
                return `${realGMBS.toFixed(1)}%`;
              })()}
            </span>
          </div>
          <div className="summary-card-item kpi-item">
            <span className="summary-card-item-label kpi-label">Hourly Price</span>
            <span className="summary-card-item-value kpi-value">
              {(() => {
                const realHourlyPrice = hourlyPriceRemote ?? hourlyPriceCalc;
                const theoreticalTO = financialBreakdown ? calculateTheoreticalTO(financialBreakdown) : null;
                const realTO = operationalRevenue ?? revenue ?? 0;
                
                if (!realHourlyPrice) return "-";
                
                // Calcular total de horas correctas del proyecto desde financialBreakdown
                const totalProjectWorkTime = financialBreakdown ? 
                  financialBreakdown.reduce((sum: number, wp: any) => 
                    sum + (wp.totals?.totalWorkTime || 0), 0) : 0;
                
                if (isIqp12 && theoreticalTO && theoreticalTO !== realTO && totalProjectWorkTime > 0) {
                  const theoreticalHourlyPrice = theoreticalTO / totalProjectWorkTime;
                  return (
                    <div 
                      className="margin-comparison"
                      title={`Hourly Price Real: ${realHourlyPrice.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})}/h (TO: ${realTO.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})}, ${totalProjectWorkTime.toLocaleString('es-ES')} h) vs Hourly Price Teórico: ${theoreticalHourlyPrice.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})}/h (TO manual: ${theoreticalTO.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})}, ${totalProjectWorkTime.toLocaleString('es-ES')} h)`}
                    >
                      <div className="margin-real">{realHourlyPrice.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 })}/h</div>
                      <div className="margin-divider"></div>
                      <div className="margin-theoretical">{theoreticalHourlyPrice.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 })}/h</div>
                    </div>
                  );
                }
                
                return `${realHourlyPrice.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 })}/h`;
              })()}
            </span>
          </div>
          <div className="summary-card-item kpi-item">
            <span className="summary-card-item-label kpi-label">GMBS in €</span>
            <span className="summary-card-item-value kpi-value">
              {(() => {
                const realTO = operationalRevenue ?? revenue ?? 0;
                const realGmbsPercentage = projectGMBSRemote != null ? projectGMBSRemote : (gm * 100);
                const realGmbsInEuros = realTO * realGmbsPercentage / 100;
                
                const theoreticalMargins = financialBreakdown ? calculateTheoreticalMargins(financialBreakdown) : null;
                const theoreticalTO = financialBreakdown ? calculateTheoreticalTO(financialBreakdown) : null;
                
                if (isIqp12 && theoreticalMargins && theoreticalTO && theoreticalTO !== realTO) {
                  const theoreticalGmbsInEuros = theoreticalTO * theoreticalMargins.GMBS / 100;
                  return (
                    <div 
                      className="margin-comparison"
                      title={`GMBS Real: ${realGmbsInEuros.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})} (${realGmbsPercentage.toFixed(1)}% de ${realTO.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})}) vs GMBS Teórico: ${theoreticalGmbsInEuros.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})} (${theoreticalMargins.GMBS.toFixed(1)}% de ${theoreticalTO.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})})`}
                    >
                      <div className="margin-real">{realGmbsInEuros.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 })}</div>
                      <div className="margin-divider"></div>
                      <div className="margin-theoretical">{theoreticalGmbsInEuros.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 })}</div>
                    </div>
                  );
                }
                
                return realGmbsInEuros.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
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
                <div className={`wp-grid ${isIqp12 ? 'wp-grid-iqp12' : ''}`}>
                  <div className="wp-grid-title">
                    <div className="wp-grid-label">Workpackage</div>
                    <strong>{wp.nombre}</strong>
                  </div>

                  <div className="wp-grid-cell">
                    <div className="wp-grid-label">Hourly Price</div>
                    <div className="wp-grid-value">
                      {(() => {
                        const realHourlyPrice = wp.totals?.hourlyPrice || 0;
                        
                        // Si hay Manual Unit Price, calcular Hourly Price teórico
                        const currentUnitPrice = tempUnitPrices[wp.id] !== undefined 
                          ? parseFloat(tempUnitPrices[wp.id]) || 0
                          : (customerUnitPrices[wp.id] || wp.totals?.customerUnitPrice || 0);
                          
                        if (isIqp12 && currentUnitPrice > 0 && wp.totals?.totalQuantity > 0 && wp.totals?.totalWorkTime > 0) {
                          const theoreticalTO = currentUnitPrice * wp.totals.totalQuantity;
                          const theoreticalHourlyPrice = theoreticalTO / wp.totals.totalWorkTime;
                          
                          return (
                            <div 
                              className="margin-comparison"
                              title={`Hourly Price Real: ${realHourlyPrice.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})}/h (TO: ${wp.totals.totalTO?.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})}) vs Hourly Price Teórico: ${theoreticalHourlyPrice.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})}/h (TO manual: ${theoreticalTO.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})})`}
                            >
                              <div className="margin-real">{realHourlyPrice.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}/h</div>
                              <div className="margin-divider"></div>
                              <div className="margin-theoretical">{theoreticalHourlyPrice.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}/h</div>
                            </div>
                          );
                        }
                        
                        return `${realHourlyPrice.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}/h`;
                      })()}
                    </div>
                  </div>

                  <div className="wp-grid-cell">
                    <div className="wp-grid-label">Operational TO</div>
                    <div className="wp-grid-value">
                      {(() => {
                        const realTO = wp.totals.totalTO || 0;
                        
                        // Si hay Manual Unit Price, calcular TO teórico
                        const currentUnitPrice = tempUnitPrices[wp.id] !== undefined 
                          ? parseFloat(tempUnitPrices[wp.id]) || 0
                          : (customerUnitPrices[wp.id] || wp.totals.customerUnitPrice || 0);
                          
                        if (isIqp12 && currentUnitPrice > 0 && wp.totals.totalQuantity > 0) {
                          const theoreticalTO = currentUnitPrice * wp.totals.totalQuantity;
                          
                          return (
                            <div 
                              className="margin-comparison"
                              title={`TO Real: ${realTO.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})} vs TO Teórico: ${theoreticalTO.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})} (${currentUnitPrice.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})} × ${wp.totals.totalQuantity})`}
                            >
                              <div className="margin-real">{realTO.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                              <div className="margin-divider"></div>
                              <div className="margin-theoretical">{theoreticalTO.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                            </div>
                          );
                        }
                        
                        return realTO.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
                      })()}
                    </div>
                  </div>

                  <div className="wp-grid-cell">
                    <div className="wp-grid-label">DM</div>
                    <div className="wp-grid-value">
                      {(() => {
                        const realDM = (wp.totals.dm || 0).toFixed(1);
                        
                        // Si hay Manual Unit Price, calcular DM teórico
                        const currentUnitPrice = tempUnitPrices[wp.id] !== undefined 
                          ? parseFloat(tempUnitPrices[wp.id]) || 0
                          : (customerUnitPrices[wp.id] || wp.totals.customerUnitPrice || 0);
                          
                        if (isIqp12 && currentUnitPrice > 0 && wp.totals.totalQuantity > 0) {
                          const theoreticalTO = currentUnitPrice * wp.totals.totalQuantity;
                          const theoreticalMargins = calculateMarginsSimple({
                            givenTO: theoreticalTO,
                            totalDmCosts: wp.totals.totalCosts || 0,
                            totalGmbsCosts: wp.totals.totalGmbsCosts || 0
                          });
                          
                          return (
                            <div 
                              className="margin-comparison"
                              title={`DM Real: ${realDM}% (TO actual: ${wp.totals.totalTO?.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})}) vs DM Teórico: ${theoreticalMargins.DM.toFixed(1)}% (TO manual: ${theoreticalTO.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})})`}
                            >
                              <div className="margin-real">{realDM}%</div>
                              <div className="margin-divider"></div>
                              <div className="margin-theoretical">{theoreticalMargins.DM.toFixed(1)}%</div>
                            </div>
                          );
                        }
                        
                        return `${realDM}%`;
                      })()}
                    </div>
                  </div>

                  <div className="wp-grid-cell">
                    <div className="wp-grid-label">GMBS</div>
                    <div className="wp-grid-value">
                      {(() => {
                        const realGMBS = (wp.totals.gmbs || 0).toFixed(1);
                        
                        // Si hay Manual Unit Price, calcular GMBS teórico
                        const currentUnitPrice = tempUnitPrices[wp.id] !== undefined 
                          ? parseFloat(tempUnitPrices[wp.id]) || 0
                          : (customerUnitPrices[wp.id] || wp.totals.customerUnitPrice || 0);
                          
                        if (isIqp12 && currentUnitPrice > 0 && wp.totals.totalQuantity > 0) {
                          const theoreticalTO = currentUnitPrice * wp.totals.totalQuantity;
                          const theoreticalMargins = calculateMarginsSimple({
                            givenTO: theoreticalTO,
                            totalDmCosts: wp.totals.totalCosts || 0,
                            totalGmbsCosts: wp.totals.totalGmbsCosts || 0
                          });
                          
                          return (
                            <div 
                              className="margin-comparison"
                              title={`GMBS Real: ${realGMBS}% (TO actual: ${wp.totals.totalTO?.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})}) vs GMBS Teórico: ${theoreticalMargins.GMBS.toFixed(1)}% (TO manual: ${theoreticalTO.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})})`}
                            >
                              <div className="margin-real">{realGMBS}%</div>
                              <div className="margin-divider"></div>
                              <div className="margin-theoretical">{theoreticalMargins.GMBS.toFixed(1)}%</div>
                            </div>
                          );
                        }
                        
                        return `${realGMBS}%`;
                      })()}
                    </div>
                  </div>

                  {/* Mostrar Unit Price solo para proyectos IQP 1-2 */}
                  {isIqp12 && (
                    <div className="wp-grid-cell">
                      <div className="wp-grid-label">Unit Price</div>
                      <div className="wp-grid-value">{(wp.totals.unitPrice || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                    </div>
                  )}

                  {/* Mostrar Manual Unit Price solo para proyectos IQP 1-2 */}
                  {isIqp12 && (
                    <div className="wp-grid-cell">
                      <div className="wp-grid-label">Manual Unit Price ✏️</div>
                      <div className="wp-grid-value">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tempUnitPrices[wp.id] !== undefined ? tempUnitPrices[wp.id] : (customerUnitPrices[wp.id]?.toString() || '')}
                          placeholder={customerUnitPrices[wp.id] ? `€ ${customerUnitPrices[wp.id].toFixed(2)}` : "€ 0.00"}
                          className={`manual-unit-price-input ${tempUnitPrices[wp.id] !== undefined ? 'editing' : ''}`}
                          title={tempUnitPrices[wp.id] !== undefined ? "Press Tab or click outside to save" : "Click to edit manual unit price"}
                          onChange={(e) => {
                            // Actualización temporal solo para la UI (sin API call)
                            setTempUnitPrices(prev => ({
                              ...prev,
                              [wp.id]: e.target.value
                            }));
                          }}
                          onBlur={async (e) => {
                            const newValue = e.target.value === '' ? null : parseFloat(e.target.value);
                            
                            // Para IQP 1-2, siempre hay un único deliverable por workpackage
                            const deliverable = wp.deliverables && wp.deliverables.length > 0 ? wp.deliverables[0] : null;
                            
                            if (!deliverable) {
                              console.error('No deliverable found for workpackage', wp.id);
                              return;
                            }
                            
                            try {
                              const response = await fetch(`/deliverables/${deliverable.id}/customer-unit-price`, {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ customer_unit_price: newValue })
                              });
                              
                              if (response.ok) {
                                // Limpiar el estado temporal
                                setTempUnitPrices(prev => {
                                  const updated = { ...prev };
                                  delete updated[wp.id];
                                  return updated;
                                });
                                
                                // Actualizar el estado de customer unit prices
                                setCustomerUnitPrices(prev => {
                                  const updated = { ...prev };
                                  if (newValue !== null && newValue !== undefined) {
                                    updated[wp.id] = newValue;
                                  } else {
                                    delete updated[wp.id];
                                  }
                                  return updated;
                                });
                                
                                // Actualizar el estado local y recalcular márgenes teóricos
                                setFinancialBreakdown(prev => 
                                  prev?.map(wpItem => {
                                    if (wpItem.id === wp.id) {
                                      const updatedWp = { 
                                        ...wpItem, 
                                        totals: { 
                                          ...wpItem.totals, 
                                          customerUnitPrice: newValue 
                                        }
                                      };
                                      
                                      // Log para debugging
                                      if (newValue && wpItem.totals.totalQuantity > 0) {
                                        const theoreticalTO = newValue * wpItem.totals.totalQuantity;
                                        console.log(`📊 Manual Unit Price updated for ${wpItem.nombre}:`, {
                                          unitPrice: newValue,
                                          totalQuantity: wpItem.totals.totalQuantity,
                                          theoreticalTO: theoreticalTO,
                                          realTO: wpItem.totals.totalTO
                                        });
                                      }
                                      
                                      return updatedWp;
                                    }
                                    return wpItem;
                                  }) || null
                                );
                              } else {
                                console.error('Failed to update customer unit price');
                                // Revertir el valor temporal en caso de error
                                setTempUnitPrices(prev => {
                                  const updated = { ...prev };
                                  delete updated[wp.id];
                                  return updated;
                                });
                              }
                            } catch (error) {
                              console.error('Error updating customer unit price:', error);
                              // Revertir el valor temporal en caso de error
                              setTempUnitPrices(prev => {
                                const updated = { ...prev };
                                delete updated[wp.id];
                                return updated;
                              });
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}

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
