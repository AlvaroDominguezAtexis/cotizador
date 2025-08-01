import React, { useState, useEffect } from 'react';
import './CountrySelector.css';


interface Country {
  id: string;
  name: string;
}

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
  const [availableCountries, setAvailableCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch countries from backend on mount
  useEffect(() => {
    const fetchCountries = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/countries');
        if (!res.ok) throw new Error('Error fetching countries');
        const data = await res.json();
        setAvailableCountries(data);
      } catch (err: any) {
        setError('No se pudieron cargar los países');
      } finally {
        setLoading(false);
      }
    };
    fetchCountries();
  }, []);

  // Efecto para notificar cambios
  useEffect(() => {
    onChange(countries);
  }, [countries, onChange]);


  // Filtrar países disponibles
  const filteredCountries = availableCountries
    .filter(country =>
      !countries.includes(country.id) &&
      country.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // Agregar país
  const addCountry = (countryId: string) => {
    if (countries.length < max && !countries.includes(countryId)) {
      setCountries(prev => [...prev, countryId]);
      setSearchTerm('');
    }
  };

  // Eliminar país
  const removeCountry = (countryId: string) => {
    setCountries(prev => prev.filter(id => id !== countryId));
  };

  return (
    <div className="country-selector">
      <div className="country-selector-header">
        <label>Involved countries</label>
      </div>

      {/* Países seleccionados */}
      <div className="selected-countries">
        {countries.map(id => {
          const country = availableCountries.find(c => String(c.id) === String(id));
          return (
            <div key={id} className="selected-country-tag">
              {country?.name || id}
              <button 
                type="button"
                className="remove-country-btn"
                onClick={() => removeCountry(id)}
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
          placeholder="Select country..."
          className="country-search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={countries.length >= max}
        />

        {searchTerm && filteredCountries.length > 0 && (
          <div className="country-suggestions">
            {filteredCountries.map(country => (
              <button
                key={country.id}
                type="button"
                className="country-suggestion-item"
                onClick={() => addCountry(country.id)}
              >
                {country.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mensajes de estado */}
      {loading && <div className="country-selector-hint">Cargando países...</div>}
      {error && <div className="country-selector-max-warning">{error}</div>}
      {countries.length >= max && !loading && (
        <div className="country-selector-max-warning">
          Se ha alcanzado el número máximo de países ({max})
        </div>
      )}
    </div>
  );
};

export default CountrySelector;