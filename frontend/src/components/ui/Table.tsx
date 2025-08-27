import React, { useState, useMemo, useCallback } from 'react';
import { SortConfig, PaginationConfig } from '../../types/common';
import { Button } from './Button';
import { Input } from './Input';
import { LoadingSpinner } from './LoadingSpinner';
import './Table.css';

// Helper para convertir valores a ReactNode de forma segura
const safeRenderValue = (value: any): React.ReactNode => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (React.isValidElement(value)) return value;

  if (Array.isArray(value)) {
    return value.map((item, idx) => {
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
        return <span key={idx} className="table-array-item">{String(item)}</span>;
      }
      return null;
    }).filter(Boolean);
  }

  if (typeof value === 'object') {
    try {
      const jsonString = JSON.stringify(value);
      if (jsonString.length > 50) {
        return <span className="table-object-indicator" title={jsonString}>[Object]</span>;
      }
      return jsonString;
    } catch {
      return '[Object]';
    }
  }

  return String(value);
};

export interface TableColumn<T = any> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  fixed?: 'left' | 'right';
  ellipsis?: boolean;
  className?: string;
}

export interface TableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];
  rowKey?: keyof T | ((record: T) => string | number);
  expandable?: {
    expandedRowRender: (record: T, index: number) => React.ReactNode;
    rowExpandable?: (record: T) => boolean;
    expandedRowKeys?: (string | number)[];
    onExpand?: (expanded: boolean, record: T) => void;
  };
  title?: string;
  description?: string;
  loading?: boolean;
  emptyText?: string;
  pagination?: PaginationConfig | false;
  onPageChange?: (page: number) => void;
  sortConfig?: SortConfig;
  onSort?: (sortConfig: SortConfig) => void;
  selectable?: boolean;
  selectedRows?: (string | number)[];
  onSelectionChange?: (selectedKeys: (string | number)[], selectedRows: T[]) => void;
  filterable?: boolean;
  onFilter?: (filters: Record<string, any>) => void;
  bordered?: boolean;
  hoverable?: boolean;
  striped?: boolean;
  size?: 'small' | 'medium' | 'large';
  scrollX?: number | string;
  scrollY?: number | string;
  className?: string;
  onRowClick?: (record: T, index: number) => void;
  onRowDoubleClick?: (record: T, index: number) => void;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  /** Clase CSS dinámica por fila */
  rowClassName?: (record: T, index: number) => string;
}

export const Table = <T extends Record<string, any>>({
  data,
  columns,
  rowKey = 'id',
  title,
  description,
  loading = false,
  emptyText = 'No hay datos disponibles',
  pagination,
  onPageChange,
  sortConfig,
  onSort,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  filterable = false,
  onFilter,
  bordered = true,
  hoverable = true,
  striped = false,
  size = 'medium',
  scrollX,
  scrollY,
  className = '',
  onRowClick,
  onRowDoubleClick,
  headerActions,
  footer,
  rowClassName,
  expandable
}: TableProps<T>) => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [internalExpandedKeys, setInternalExpandedKeys] = useState<(string | number)[]>([]);

  // Obtener clave única de fila
  const getRowKey = useCallback((record: T, index: number): string | number => {
    if (typeof rowKey === 'function') {
      return rowKey(record);
    }
    return record[rowKey] ?? index;
  }, [rowKey]);

  // Procesar datos (filtros y orden)
  const processedData = useMemo(() => {
    let result = [...data];

    if (filterable && Object.keys(filters).length > 0) {
      result = result.filter(record =>
        Object.entries(filters).every(([key, filterValue]) => {
          if (!filterValue) return true;
          const recordValue = record[key];
          return String(recordValue).toLowerCase().includes(filterValue.toLowerCase());
        })
      );
    }

    if (sortConfig && onSort) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === bValue) return 0;
        const comparison = aValue < bValue ? -1 : 1;
        return sortConfig.direction === 'desc' ? -comparison : comparison;
      });
    }

    return result;
  }, [data, filters, sortConfig, filterable, onSort]);

  // Paginación
  const paginatedData = useMemo(() => {
    if (!pagination) return processedData;
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return processedData.slice(start, end);
  }, [processedData, pagination]);

  // Sort
  const handleSort = (key: string) => {
    if (!onSort) return;
    const newDirection =
      sortConfig?.key === key && sortConfig.direction === 'asc'
        ? 'desc'
        : 'asc';
    onSort({ key, direction: newDirection });
  };

  // Filter
  const handleFilter = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilter?.(newFilters);
  };

  // Selección
  const handleRowSelection = (recordKey: string | number, record: T, checked: boolean) => {
    if (!onSelectionChange) return;
    let newSelectedKeys: (string | number)[] = checked
      ? [...selectedRows, recordKey]
      : selectedRows.filter(key => key !== recordKey);

    const newSelectedRows = data.filter(record =>
      newSelectedKeys.includes(getRowKey(record, data.indexOf(record)))
    );
    onSelectionChange(newSelectedKeys, newSelectedRows);
  };

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      const allKeys = paginatedData.map((record, index) => getRowKey(record, index));
      onSelectionChange(allKeys, paginatedData);
    } else {
      onSelectionChange([], []);
    }
  };

  const isAllSelected = paginatedData.length > 0 &&
    paginatedData.every((record, index) => selectedRows.includes(getRowKey(record, index)));

  const isIndeterminate = selectedRows.length > 0 && !isAllSelected;

  const tableClasses = [
    'table-container',
    `table-size-${size}`,
    bordered ? 'table-bordered' : '',
    hoverable ? 'table-hoverable' : '',
    striped ? 'table-striped' : '',
    className
  ].filter(Boolean).join(' ');

  const renderColumnHeader = (column: TableColumn<T>) => {
    const sortIcon = sortConfig?.key === column.key ? (
      sortConfig.direction === 'asc' ? ' ↑' : ' ↓'
    ) : '';

    return (
      <th
        key={column.key}
        className={`table-header-cell ${column.className || ''} ${column.align ? `text-${column.align}` : ''}`}
        style={{ width: column.width }}
        onClick={column.sortable ? () => handleSort(column.key) : undefined}
      >
        <div className="table-header-content">
          <span className={`table-header-title ${column.sortable ? 'sortable' : ''}`}>
            {column.title}{sortIcon}
          </span>
          {filterable && column.filterable && (
            <div className="table-filter" onClick={e => e.stopPropagation()}>
              <Input
                inputSize="sm"
                placeholder={`Filtrar ${column.title}`}
                value={filters[column.key] || ''}
                onChange={e => handleFilter(column.key, e.target.value)}
              />
            </div>
          )}
        </div>
      </th>
    );
  };

  const renderCell = (column: TableColumn<T>, record: T, index: number) => {
    if (column.render) {
      return safeRenderValue(column.render(record[column.dataIndex || column.key], record, index));
    }
    return safeRenderValue(record[column.dataIndex || column.key]);
  };

  return (
    <div className={tableClasses}>
      {(title || description || headerActions) && (
        <div className="table-header">
          <div className="table-header-info">
            {title && <h3 className="table-title">{title}</h3>}
            {description && <p className="table-description">{description}</p>}
          </div>
          {headerActions && (
            <div className="table-header-actions">
              {headerActions}
            </div>
          )}
        </div>
      )}

      <div className="table-wrapper" style={{ overflowX: scrollX ? 'auto' : 'visible', maxHeight: scrollY }}>
        <table className="table">
          <thead className="table-thead">
            <tr>
              {selectable && (
                <th className="table-header-cell table-selection-cell">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                    onChange={e => handleSelectAll(e.target.checked)}
                  />
                </th>
              )}
              {expandable && <th className="table-header-cell" style={{ width: 36 }}></th>}
              {columns.map(renderColumnHeader)}
            </tr>
          </thead>
          <tbody className="table-tbody">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="table-loading-cell">
                  <LoadingSpinner text="Cargando datos..." />
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="table-empty-cell">
                  <div className="table-empty">
                    <p>{emptyText}</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((record, index) => {
                const recordKey = getRowKey(record, index);
                const isSelected = selectedRows.includes(recordKey);
                const dynamicClass = rowClassName?.(record, index) || '';
                const isExpanded = (expandable?.expandedRowKeys ?? internalExpandedKeys).includes(recordKey);

                return (
                  <React.Fragment key={recordKey}>
                    <tr
                      className={`table-row ${isSelected ? 'table-row-selected' : ''} ${dynamicClass}`}
                      onClick={() => onRowClick?.(record, index)}
                      onDoubleClick={() => onRowDoubleClick?.(record, index)}
                    >
                      {selectable && (
                        <td className="table-cell table-selection-cell">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => handleRowSelection(recordKey, record, e.target.checked)}
                          />
                        </td>
                      )}
                      {expandable && (
                        <td className="table-cell" style={{ textAlign: 'center' }}>
                          {(!expandable.rowExpandable || expandable.rowExpandable(record)) && (
                            <button
                              className="table-expand-btn"
                              aria-label={isExpanded ? 'Contraer' : 'Expandir'}
                              onClick={(e) => {
                                e.stopPropagation();
                                const next = new Set<string | number>(
                                  (expandable?.expandedRowKeys as (string | number)[] | undefined) ?? internalExpandedKeys
                                );
                                if (isExpanded) {
                                  next.delete(recordKey);
                                  expandable?.onExpand?.(false, record);
                                } else {
                                  next.add(recordKey);
                                  expandable?.onExpand?.(true, record);
                                }
                                setInternalExpandedKeys(Array.from(next) as (string | number)[]);
                              }}
                            >
                              {isExpanded ? '▲' : '▼'}
                            </button>
                          )}
                        </td>
                      )}
                      {columns.map(column => (
                        <td 
                          key={column.key} 
                          className={`table-cell ${column.className || ''} ${column.align ? `text-${column.align}` : ''}`}
                        >
                          {renderCell(column, record, index)}
                        </td>
                      ))}
                    </tr>
                    {expandable && isExpanded && (
                      <tr className="table-expanded-row">
                        <td colSpan={columns.length + (selectable ? 1 : 0) + 1} className="table-cell table-expanded-cell">
                          {expandable.expandedRowRender(record, index)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {footer && <div className="table-footer">{footer}</div>}
    </div>
  );
};

export default Table;
