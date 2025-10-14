import { useState, useEffect } from 'react';
import { apiConfig } from '../utils/apiConfig';

export interface Country {
  id: string;
  name: string;
}

export function useCountryNames(ids: string[] = []) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ids.length) {
      setCountries([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(apiConfig.url('/api/countries'), {
      credentials: 'include'
    })
      .then(res => res.json())
      .then((all: Country[]) => {
        // Mantener el orden de ids
        const idSet = new Set(ids.map(String));
        const filtered = all.filter(c => idSet.has(String(c.id)));
        // Ordenar según el orden de ids
        const ordered = ids
          .map(id => filtered.find(c => String(c.id) === String(id)))
          .filter(Boolean) as Country[];
        setCountries(ordered);
        setLoading(false);
      })
      .catch(() => {
        setError('No se pudieron cargar los países');
        setLoading(false);
      });
  }, [JSON.stringify(ids)]);

  return { countries, loading, error };
}
