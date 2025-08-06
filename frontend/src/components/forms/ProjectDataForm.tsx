import React, { useState, useEffect } from 'react';
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
  useEffect(() => {
    const fetchBusinessUnits = async () => {
      try {
        const res = await fetch('/business-units');
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
        const res = await fetch('/clients');
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
        const res = await fetch('/bu-lines');
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
        const res = await fetch('/ops-domains');
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
      scope: 'local',
      additionalCountries: [],
      iqp: 1,
      segmentation: 'New Business',
      description: '',
    }
  );

  React.useEffect(() => {
    if (initialValues) {
      setFormData(initialValues);
    }
  }, [initialValues]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Only call onChange when formData actually changes
  React.useEffect(() => {
    if (onChange) onChange(formData);
  }, [formData, onChange]);



  return (
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
          <label>Fecha de Inicio</label>
          <input
            type="date"
            name="startDate"
            value={formData.startDate}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Fecha de Fin</label>
          <input
            type="date"
            name="endDate"
            value={formData.endDate}
            onChange={handleInputChange}
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

        <div className="form-group">
          <label>País(es)</label>
          <CountrySelector
            selectedCountries={formData.additionalCountries || []}
            onChange={(countries) => {
              setFormData((prev) => ({ ...prev, additionalCountries: countries }));
            }}
            max={10}
          />
        </div>

        <div className="form-group">
          <label>Ámbito</label>
          <select
            name="scope"
            value={formData.scope}
            onChange={handleInputChange}
          >
            <option value="local">Local</option>
            <option value="transnational">Transnacional</option>
          </select>
        </div>

        <div className="form-group">
          <label>IQP</label>
          <select
            name="iqp"
            value={formData.iqp}
            onChange={handleInputChange}
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
  );
};

export default ProjectDataForm;
