import { ProjectData } from '../types/project';
import React, { useState, useMemo, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import './Menu.css';

// Traemos el mapper desde utils para unificar la lógica y evitar dependencias circulares
import { mapProjectFromBackend } from '../utils/projectMapper';

export interface Quote {
  id: string;
  name: string;
  createdAt: string;
  client?: string;
  status?: string;
  description?: string;
  totalAmount?: number;
  DM?: number;
}

interface MenuProps {
  user: string;
  onGoToProjectDataTab: () => void;
  onOpenProject: (project: any) => void;
  onLogout: () => void;
}

const sortOptions = [
  { value: 'createdAt', label: 'Creation Date' },
  { value: 'name', label: 'Name' },
  { value: 'client', label: 'Client' },
  { value: 'status', label: 'Status' },
];

export const Menu: React.FC<MenuProps> = ({ user, onGoToProjectDataTab, onOpenProject, onLogout }) => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch projects from API
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const response = await fetch('http://localhost:4000/api/projects', {
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Error fetching projects');
        const data = await response.json();
        
        // Guardamos el objeto completo para poder mapearlo después correctamente
        setQuotes(
          data.map((project: any) => {
            return {
              // Guardamos todos los datos originales para abrir el proyecto correctamente
              ...project,
              // Campos para la tabla (DESPUÉS del spread para sobrescribir)
              id: project.id,
              name: project.title,
              client: project.client_name, // Usar client_name del backend
              createdAt: project.created_at,
              status: project.status,
              totalAmount: project.to,
              DM: project.dm
            };
          })
        );
      } catch (error) {
        console.error('Error fetching projects', error);
        setQuotes([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, [user]);

  const filteredQuotes = useMemo(() => {
    let filtered = quotes.filter((q: Quote) =>
      q.name.toLowerCase().includes(filter.toLowerCase()) ||
      (q.client?.toLowerCase().includes(filter.toLowerCase()) ?? false)
    );
    return filtered.sort((a: Quote, b: Quote) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'client':
          aVal = (a.client || '').toLowerCase();
          bVal = (b.client || '').toLowerCase();
          break;
        case 'status':
          aVal = (a.status || '').toLowerCase();
          bVal = (b.status || '').toLowerCase();
          break;
        case 'createdAt':
        default:
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [quotes, filter, sortBy, sortDir]);

  if (loading) {
    return (
      <Layout
        user={user}
        onLogout={onLogout}
        activeTab="project-data"
        onTabChange={() => {}}
      >
        <div>Loading projects...</div>
      </Layout>
    );
  }

  return (
    <Layout
      user={user}
      onLogout={onLogout}
      activeTab="project-data"
      onTabChange={() => {}}
    >
      <div className="menu-container">
        <header className="menu-header">
          <h1>My Projects</h1>
          <div className="menu-actions">
            <Button
              variant="secondary"
              onClick={() => {}}
            >
              Compare Quotes
            </Button>
            <Button
              variant="primary"
              onClick={onGoToProjectDataTab}
            >
              Create New Project
            </Button>
          </div>
        </header>

        <div className="filter-sort-bar">
          <input
            className="filter-input"
            type="text"
            placeholder="Filter by name or client..."
            value={filter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
          />
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value)}
          >
            {sortOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </Button>
        </div>

        <table className="quotes-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Client</th>
              <th>Creation Date</th>
              <th>Status</th>
              <th>TO</th>
              <th>DM</th>
              <th className="action-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredQuotes.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#888' }}>
                  No projects available.
                </td>
              </tr>
            ) : filteredQuotes.map((quote) => (
              <tr
                key={quote.id}
                onDoubleClick={() => {
                  // Usamos el mapper unificado para abrir el proyecto con fechas correctas
                  const backendProject = quotes.find(q => q.id === quote.id);
                  if (backendProject) {
                    onOpenProject(mapProjectFromBackend(backendProject));
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <td>{quote.name}</td>
                <td>{quote.client || '-'}</td>
                <td>{new Date(quote.createdAt).toLocaleDateString()}</td>
                <td>{quote.status || 'Draft'}</td>
                <td>{quote.totalAmount ? `${Number(quote.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '-'}</td>
                <td>{quote.DM != null ? `${Number(quote.DM).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : 'Draft'}</td>
                <td className="action-cell">
                  <Button
                    variant="danger"
                    size="sm"
                    title="Delete project"
                    onClick={e => {
                      e.stopPropagation();
                      if (window.confirm('Are you sure you want to delete this project?')) {
                        fetch(`http://localhost:4000/api/projects/${quote.id}`, { 
                          method: 'DELETE', 
                          credentials: 'include' 
                        })
                          .then(() => {
                            setQuotes(prev => prev.filter(q => q.id !== quote.id));
                          });
                      }
                    }}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
};
