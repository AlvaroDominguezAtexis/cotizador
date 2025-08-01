import { useEffect, useState } from 'react';

export interface OfficialProfile {
  id: string;
  name: string;
}

export function useOfficialProfiles() {
  const [profiles, setProfiles] = useState<OfficialProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('/profiles?official=true')
      .then(res => res.json())
      .then((data: OfficialProfile[]) => {
        setProfiles(data);
        setLoading(false);
      })
      .catch(() => {
        setError('No se pudieron cargar los perfiles oficiales');
        setLoading(false);
      });
  }, []);

  return { profiles, loading, error };
}
