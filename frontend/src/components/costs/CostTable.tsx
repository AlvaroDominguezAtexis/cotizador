// src/components/costs/CostTable.tsx
import React, { useMemo } from 'react';
import './Costs.css';

interface CostTableColumn {
  key: string;
  title: string;
  render: (value: any, record: any, index: number) => React.ReactNode;
  className?: string;
}

interface CostTableProps {
  data: any[];
  columns: CostTableColumn[];
  /** Clase CSS dinámica por fila */
  rowClassName?: (record: any, index: number) => string;
}

export const CostTable: React.FC<CostTableProps> = ({
  data,
  columns,
  rowClassName
}) => {
  // Calcular coste total
  const totalCost = useMemo(() => {
    return data.reduce((total, item) => {
      return total + (item.quantity * item.unitCost);
    }, 0);
  }, [data]);

  // Calcular desglose de costes refacturables
  const costBreakdown = useMemo(() => {
    const refacturable = data
      .filter(item => item.refactorable)
      .reduce((total, item) => total + (item.quantity * item.unitCost), 0);

    const noRefacturable = data
      .filter(item => !item.refactorable)
      .reduce((total, item) => total + (item.quantity * item.unitCost), 0);

    return { refacturable, noRefacturable };
  }, [data]);

  // Si no hay datos, no renderizar nada
  if (data.length === 0) {
    return null;
  }

  return (
    <div className="cost-table-container">
      <table className="table">
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} className={c.className || ''}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((record, index) => (
            <tr
              key={record.id ?? index}
              className={rowClassName?.(record, index) || ''}
            >
              {columns.map(col => (
                <td key={col.key} className={col.className || ''}>
                  {col.render(record[col.key], record, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* --- Bloque de totales mejorado --- */}
      <div className="cost-table-total">
        <div className="cost-table-total-summary">
          <div className="total-row">
            <span>Refacturable:</span>
            <span>
              €{costBreakdown.refacturable.toLocaleString('es-ES', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </span>
          </div>
          <div className="total-row">
            <span>No Refacturable:</span>
            <span>
              €{costBreakdown.noRefacturable.toLocaleString('es-ES', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </span>
          </div>
          <div className="total-row total-row-highlight">
            <span>Coste Total:</span>
            <span>
              €{totalCost.toLocaleString('es-ES', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostTable;
