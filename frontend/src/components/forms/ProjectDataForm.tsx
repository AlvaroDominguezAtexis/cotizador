import React, { useState, useEffect, useCallback } from 'react';
import CountrySelector from './CountrySelector';
import { ProjectData } from '../../types/project';
import './ProjectDataForm.css';

interface Props {
  onChange?: (data: ProjectData) => void;
  initialValues?: ProjectData;
}


type BusinessUnit = { id: string; name: string };

const ProjectDataForm: React.FC<Props> = ({ onChange, initialValues }) => {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [showIqpWarning, setShowIqpWarning] = useState(false);
  const [pendingIqpValue, setPendingIqpValue] = useState<number | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  useEffect(() => {
    const fetchBusinessUnits = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/business-units', {
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Error fetching business units');
        const data = await res.json();
        setBusinessUnits(data);
      } catch (err) {
        setBusinessUnits([]);
      }
    };
    fetchBusinessUnits();
  }, []);


  const [buLines, setBuLines] = useState<{ id: string; name: string }[]>([]);
  const [opsDomains, setOpsDomains] = useState<{ id: string; name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/clients', {
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Error fetching clients');
        const data = await res.json();
        setClients(data);
      } catch (err) {
        setClients([]);
      }
    };
    fetchClients();
  }, []);

  useEffect(() => {
    const fetchBuLines = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/bu-lines', {
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Error fetching BU lines');
        const data = await res.json();
        setBuLines(data);
      } catch (err) {
        setBuLines([]);
      }
    };
    fetchBuLines();
  }, []);

  useEffect(() => {
    const fetchOpsDomains = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/ops-domains', {
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Error fetching ops domains');
        const data = await res.json();
        setOpsDomains(data);
      } catch (err) {
        setOpsDomains([]);
      }
    };
    fetchOpsDomains();
  }, []);

  const [formData, setFormData] = useState<ProjectData>(
    initialValues || {
      title: '',
      crmCode: '',
      client: '',
      activity: '',
      startDate: '',
      endDate: '',
      businessManager: '',
      businessUnit: '',
      buLine: '',
      opsDomain: '',
      country: '',
      countries: [],
      iqp: 0, // Cambio a 0 para indicar vacío
      marginType: '',
      marginGoal: '',
      segmentation: 'New Business',
      description: '',
    }
  );

  React.useEffect(() => {
    if (initialValues) {
      const incomingMargin = (initialValues as any).marginGoal;
      const incomingMarginType = (initialValues as any).marginType;
      const normalized = typeof incomingMargin === 'number'
        ? incomingMargin
        : (incomingMargin === '' || incomingMargin == null) && incomingMarginType
          ? 0
          : (incomingMargin || '');
      setFormData(prev => ({
        ...prev,
        ...initialValues,
        marginGoal: normalized,
      }));
    }
  }, [initialValues]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    // Manejo especial para IQP
    if (name === 'iqp') {
      const newIqpValue = Number(value) || 0;
      const oldIqp = formData.iqp;
      
      // Si ya existe un proyecto con IQP y se quiere cambiar entre categorías diferentes
      if (initialValues?.id && oldIqp > 0 && newIqpValue > 0) {
        const oldCategory = oldIqp <= 2 ? 'simple' : 'complex';
        const newCategory = newIqpValue <= 2 ? 'simple' : 'complex';
        
        if (oldCategory !== newCategory) {
          setPendingIqpValue(newIqpValue);
          setShowIqpWarning(true);
          return; // No actualizar aún
        }
      }
      
      setFormData((prev) => ({ ...prev, iqp: newIqpValue }));
      return;
    }

    // Keep numeric with decimals for marginGoal, everything else as string
    if (name === 'marginGoal') {
      const cleaned = value.replace(/,/g, '.');
      // Accept empty string, else cast to number
      const nextVal = cleaned === '' ? '' : Number(cleaned);
      setFormData((prev) => ({ ...prev, marginGoal: nextVal }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCountriesChange = useCallback((countries: string[]) => {
    setFormData((prev) => ({ ...prev, countries }));
  }, []);

  const handleConfirmIqpChange = async () => {
    if (!initialValues?.id || pendingIqpValue === null) return;
    
    setIsClearing(true);
    try {
      // Llamar al endpoint para limpiar workpackages
      const response = await fetch(`http://localhost:4000/api/projects/${initialValues.id}/clear-workpackages`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al limpiar workpackages');
      }
      
      const result = await response.json();
      console.log('Workpackages eliminados:', result.deleted_workpackages);
      
      // Actualizar el IQP en el formulario
      setFormData(prev => ({ ...prev, iqp: pendingIqpValue }));
      
    } catch (error) {
      console.error('Error al confirmar cambio de IQP:', error);
      alert(`Error al limpiar los workpackages: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      // Resetear el estado del modal
      setShowIqpWarning(false);
      setPendingIqpValue(null);
      setIsClearing(false);
    }
  };

  const handleCancelIqpChange = () => {
    setShowIqpWarning(false);
    setPendingIqpValue(null);
    setIsClearing(false);
  };

  // Only call onChange when formData actually changes and is valid
  React.useEffect(() => {
    // Para proyectos nuevos, IQP es obligatorio
    const isValidForNewProject = !initialValues?.id ? formData.iqp > 0 : true;
    
    if (onChange && isValidForNewProject) {
      onChange(formData);
    }
  }, [formData, onChange, initialValues?.id]);



  return (
    <div>
      <form className="project-data-form">
      <h2 className="form-title">Información del Proyecto</h2>

      {/* Grid principal */}
      <div className="project-form-grid">
        <div className="form-group">
          <label>Título *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Código CRM</label>
          <input
            type="text"
            name="crmCode"
            value={formData.crmCode}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Cliente</label>
          <select
            name="client"
            value={formData.client}
            onChange={handleInputChange}
          >
            <option value="">Selecciona un cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Fecha de Inicio *</label>
          <input
            type="date"
            name="startDate"
            value={formData.startDate}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Fecha de Fin *</label>
          <input
            type="date"
            name="endDate"
            value={formData.endDate}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Manager del Negocio</label>
          <input
            type="text"
            name="businessManager"
            value={formData.businessManager}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Unidad de Negocio</label>
          <select
            name="businessUnit"
            value={formData.businessUnit}
            onChange={handleInputChange}
          >
            <option value="">Seleccione una unidad</option>
            {businessUnits.map((unit) => (
              <option key={unit.id} value={unit.name}>{unit.name}</option>
            ))}
          </select>
        </div>


        <div className="form-group">
          <label>Dominio Operativo</label>
          <select
            name="opsDomain"
            value={formData.opsDomain}
            onChange={handleInputChange}
          >
            <option value="">Seleccione un dominio</option>
            {opsDomains.map((domain) => (
              <option key={domain.id} value={domain.name}>{domain.name}</option>
            ))}
          </select>
        </div>

        

        <div className="form-group">
          <label>BU Line</label>
          <select
            name="buLine"
            value={formData.buLine || ''}
            onChange={handleInputChange}
          >
            <option value="">Seleccione una línea</option>
            {buLines.map((line) => (
              <option key={line.id} value={line.name}>{line.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Actividad</label>
          <input
            type="text"
            name="activity"
            value={formData.activity}
            onChange={handleInputChange}
          />
        </div>

        

  {/* Ámbito eliminado */}

        <div className="form-group">
          <label>IQP *</label>
          <select
            name="iqp"
            value={formData.iqp || ''}
            onChange={handleInputChange}
            required
          >
            <option value="">Seleccione IQP</option>
            {[1,2,3,4,5].map(val => (
              <option key={val} value={val}>{val}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Segmentación</label>
          <select
            name="segmentation"
            value={formData.segmentation}
            onChange={handleInputChange}
          >
            <option value="New Business">New Business</option>
            <option value="Existing Business">Existing Business</option>
          </select>
        </div>

        {/* Last three: Countries, Margin Type, Margin Goal */}
        <div className="form-group">
          <label>País(es) *</label>
          <CountrySelector
            selectedCountries={formData.countries || []}
            onChange={handleCountriesChange}
            max={10}
          />
        </div>

        <div className="form-group">
          <label>Tipo de Margen</label>
          <select
            name="marginType"
            value={formData.marginType || ''}
            onChange={handleInputChange}
          >
            <option value="">Seleccione</option>
            <option value="DM">DM</option>
            <option value="GMBS">GMBS</option>
          </select>
        </div>

        <div className="form-group">
          <label>Objetivo de Margen</label>
          <input
            type="number"
            step="0.01"
            min="0"
            name="marginGoal"
            value={formData.marginGoal ?? ''}
            onChange={handleInputChange}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Descripción ocupa todo el ancho */}
      <div className="form-group full-width">
        <label>Descripción</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          rows={4}
        />
      </div>


    </form>
    
    {/* Modal de confirmación para cambio de IQP */}
    {showIqpWarning && (
      <div className="modal-overlay">
        <div className="modal-content">
          <h3>Cambio de IQP</h3>
          <p>
            Al cambiar el IQP de una categoría a otra (IQP 1-2 ↔ IQP 3-5), 
            todos los workpackages existentes serán eliminados.
          </p>
          <p><strong>¿Está seguro de que desea continuar?</strong></p>
          <div className="modal-actions">
            <button 
              type="button" 
              onClick={handleCancelIqpChange}
              className="btn-secondary"
              disabled={isClearing}
            >
              Cancelar
            </button>
            <button 
              type="button" 
              onClick={handleConfirmIqpChange}
              className="btn-primary"
              disabled={isClearing}
            >
              {isClearing ? 'Eliminando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default ProjectDataForm;
