import React, { useState, useEffect } from 'react';
import './CountrySelector.css';

// Lista de países predefinida (puedes expandirla)
const AVAILABLE_COUNTRIES = [
  { code: 'es', name: 'España' },
  { code: 'fr', name: 'Francia' },
  { code: 'pt', name: 'Portugal' },
  { code: 'de', name: 'Alemania' },
  { code: 'it', name: 'Italia' },
  { code: 'uk', name: 'Reino Unido' },
  { code: 'us', name: 'Estados Unidos' },
  { code: 'ca', name: 'Canadá' },
  { code: 'br', name: 'Brasil' },
  { code: 'ar', name: 'Argentina' },
  { code: 'in', name: 'India' },
  { code: 'cn', name: 'China' },
  { code: 'jp', name: 'Japón' }
];

interface CountrySelectorProps {
  selectedCountries?: string[];
  onChange: (countries: string[]) => void;
  max?: number;
}

const CountrySelector: React.FC<CountrySelectorProps> = ({
  selectedCountries = [],
  onChange,
  max = 5
}) => {
  const [countries, setCountries] = useState<string[]>(selectedCountries);
  const [searchTerm, setSearchTerm] = useState('');

  // Efecto para notificar cambios
  useEffect(() => {
    onChange(countries);
  }, [countries, onChange]);

  // Filtrar países disponibles
  const availableCountries = AVAILABLE_COUNTRIES
    .filter(country => 
      // Filtrar países no seleccionados
      !countries.includes(country.code) && 
      // Filtrar por término de búsqueda
      country.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // Agregar país
  const addCountry = (countryCode: string) => {
    if (countries.length < max && !countries.includes(countryCode)) {
      setCountries(prev => [...prev, countryCode]);
      setSearchTerm('');
    }
  };

  // Eliminar país
  const removeCountry = (countryCode: string) => {
    setCountries(prev => prev.filter(code => code !== countryCode));
  };

  return (
    <div className="country-selector">
      <div className="country-selector-header">
        <label>Países Participantes:</label>
        <small className="country-selector-hint">
          Seleccione hasta {max} países
        </small>
      </div>

      {/* Países seleccionados */}
      <div className="selected-countries">
        {countries.map(code => {
          const country = AVAILABLE_COUNTRIES.find(c => c.code === code);
          return (
            <div key={code} className="selected-country-tag">
              {country?.name}
              <button 
                type="button"
                className="remove-country-btn"
                onClick={() => removeCountry(code)}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Búsqueda y selección de países */}
      <div className="country-search-container">
        <input 
          type="text"
          placeholder="Buscar país..."
          className="country-search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={countries.length >= max}
        />

        {searchTerm && availableCountries.length > 0 && (
          <div className="country-suggestions">
            {availableCountries.map(country => (
              <button
                key={country.code}
                type="button"
                className="country-suggestion-item"
                onClick={() => addCountry(country.code)}
              >
                {country.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mensaje cuando se alcanza el máximo */}
      {countries.length >= max && (
        <div className="country-selector-max-warning">
          Se ha alcanzado el número máximo de países ({max})
        </div>
      )}
    </div>
  );
};

export default CountrySelector;