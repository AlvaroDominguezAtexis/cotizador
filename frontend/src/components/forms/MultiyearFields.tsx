import React, { useMemo } from 'react';
import './MultiyearFields.css';

interface MultiyearFieldsProps {
  startYear?: number;
  endYear?: number;
  onStartYearChange: (year: number) => void;
  onEndYearChange: (year: number) => void;
  minYear?: number;
  maxYear?: number;
}

const MultiyearFields: React.FC<MultiyearFieldsProps> = ({
  startYear,
  endYear,
  onStartYearChange,
  onEndYearChange,
  minYear = new Date().getFullYear(),
  maxYear = new Date().getFullYear() + 10
}) => {
  // Generar lista de años
  const yearOptions = useMemo(() => {
    return Array.from(
      { length: maxYear - minYear + 1 }, 
      (_, index) => minYear + index
    );
  }, [minYear, maxYear]);

  // Validaciones
  const isValidYearRange = () => {
    if (!startYear || !endYear) return false;
    return startYear <= endYear;
  };

  return (
    <div className="multiyear-fields">
      <div className="multiyear-year-selector">
        <div className="year-input-group">
          <label htmlFor="startYear">Starting Year</label>
          <select
            id="startYear"
            value={startYear || ''}
            onChange={(e) => {
              const year = parseInt(e.target.value);
              onStartYearChange(year);
            }}
            className="year-select"
          >
            <option value="" disabled>Select Year</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="year-input-group">
          <label htmlFor="endYear">Ending Year</label>
          <select
            id="endYear"
            value={endYear || ''}
            onChange={(e) => {
              const year = parseInt(e.target.value);
              onEndYearChange(year);
            }}
            className="year-select"
            disabled={!startYear}
          >
            <option value="" disabled>Select Year</option>
            {yearOptions
              .filter((year) => !startYear || year >= startYear)
              .map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))
            }
          </select>
        </div>
      </div>

      {/* Mensaje de validación */}
      {startYear && endYear && !isValidYearRange() && (
        <div className="year-range-error">
          The starting year must be less than or equal to the ending year
        </div>
      )}

      {/* Información adicional */}
      <div className="multiyear-info">
        <p>
          <strong>Information:</strong> A multiyear project allows for the 
          distribution of resources and planning over several years.
        </p>
      </div>
    </div>
  );
};

export default MultiyearFields;