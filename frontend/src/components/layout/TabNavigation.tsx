import React, { useState, useRef, useEffect } from 'react';
import { TabName, TabErrors } from '../../types/common';
import './TabNavigation.css';

interface Tab {
  id: TabName;
  label: string;
  icon: React.ReactNode;
  description?: string;
  disabled?: boolean;
  badge?: string | number;
}

interface TabNavigationProps {
  /** Tab actualmente activo */
  activeTab: TabName;
  /** Función para cambiar de tab */
  onTabChange: (tab: TabName) => void;
  /** Tabs personalizados (opcional) */
  customTabs?: Tab[];
  /** Mostrar descripciones de tabs */
  showDescriptions?: boolean;
  /** Orientación de las tabs */
  orientation?: 'horizontal' | 'vertical';
  /** Permitir scroll en las tabs */
  scrollable?: boolean;
  /** Clases CSS adicionales */
  className?: string;
}

// Definición de tabs por defecto
const defaultTabs: Tab[] = [
  {
    id: 'project-data',
    label: 'Datos del Proyecto',
    description: 'Información básica y configuración del proyecto',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10,9 9,9 8,9"/>
      </svg>
    )
  },
  {
    id: 'profiles',
    label: 'Profiles',
    description: 'Gestión de perfiles del proyecto',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    )
  },
  {
    id: 'work-packages',
    label: 'Work Packages',
    description: 'Definición de entregables y tareas del proyecto',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27,6.96 12,12.01 20.73,6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    )
  },
  {
    id: 'non-operational-costs',
    label: 'Costes No Operacionales',
    description: 'Gestión de gastos adicionales y costes externos',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        <path d="M9 7v1M15 16v1"/>
      </svg>
    )
  },
  {
    id: 'summary',
    label: 'Resumen',
    description: 'Vista general y métricas del proyecto',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M9 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-4"/>
        <path d="M9 7V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3"/>
        <path d="M13 11h4"/>
        <path d="M13 15h4"/>
      </svg>
    )
  },
  {
    id: 'advance-settings',
    label: 'Advance Setting',
    description: 'Variables del proyecto (p.ej., CPI por país)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .69.28 1.35.78 1.82.5.47 1.18.73 1.87.73H21a2 2 0 1 1 0 4h-.09c-.69 0-1.35.26-1.82.78z"/>
      </svg>
    )
  }
];

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  customTabs,
  showDescriptions = false,
  orientation = 'horizontal',
  scrollable = true,
  className = ''
}) => {
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  const tabs = customTabs || defaultTabs;

  // Actualizar indicador de tab activa
  useEffect(() => {
    if (activeTabRef.current && orientation === 'horizontal') {
      const tabElement = activeTabRef.current;
      const tabRect = tabElement.getBoundingClientRect();
      const containerRect = tabsRef.current?.getBoundingClientRect();

      if (containerRect) {
        setIndicatorStyle({
          width: tabRect.width,
          transform: `translateX(${tabRect.left - containerRect.left}px)`,
          transition: 'all 0.3s ease'
        });
      }
    }
  }, [activeTab, orientation, tabs]);

  // Verificar si se necesitan flechas de scroll
  useEffect(() => {
    const checkScrollArrows = () => {
      if (tabsRef.current && scrollable && orientation === 'horizontal') {
        const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
        setShowLeftArrow(scrollLeft > 0);
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
      }
    };

    checkScrollArrows();
    
    const tabsElement = tabsRef.current;
    if (tabsElement) {
      tabsElement.addEventListener('scroll', checkScrollArrows);
      window.addEventListener('resize', checkScrollArrows);
      
      return () => {
        tabsElement.removeEventListener('scroll', checkScrollArrows);
        window.removeEventListener('resize', checkScrollArrows);
      };
    }
  }, [scrollable, orientation, tabs]);

  const handleTabClick = (tabId: TabName, disabled?: boolean) => {
    if (!disabled) {
      onTabChange(tabId);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, tabId: TabName, disabled?: boolean) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTabClick(tabId, disabled);
    }
    
    // Navegación con flechas
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      let nextIndex = currentIndex + direction;
      
      // Wrap around
      if (nextIndex >= tabs.length) nextIndex = 0;
      if (nextIndex < 0) nextIndex = tabs.length - 1;
      
      // Skip disabled tabs
      while (tabs[nextIndex]?.disabled && nextIndex !== currentIndex) {
        nextIndex += direction;
        if (nextIndex >= tabs.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = tabs.length - 1;
      }
      
      if (!tabs[nextIndex]?.disabled) {
        onTabChange(tabs[nextIndex].id);
      }
    }
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      const scrollAmount = 200;
      const newScrollLeft = tabsRef.current.scrollLeft + (direction === 'right' ? scrollAmount : -scrollAmount);
      tabsRef.current.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
    }
  };

  const scrollToActiveTab = () => {
    if (activeTabRef.current && tabsRef.current) {
      const tabElement = activeTabRef.current;
      const containerElement = tabsRef.current;
      
      const tabRect = tabElement.getBoundingClientRect();
      const containerRect = containerElement.getBoundingClientRect();
      
      if (tabRect.left < containerRect.left || tabRect.right > containerRect.right) {
        const scrollLeft = tabElement.offsetLeft - (containerElement.clientWidth - tabElement.clientWidth) / 2;
        containerElement.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    }
  };

  // Auto-scroll a la tab activa cuando cambie
  useEffect(() => {
    scrollToActiveTab();
  }, [activeTab]);

  const navigationClasses = [
    'tab-navigation',
    `tab-navigation-${orientation}`,
    scrollable ? 'tab-navigation-scrollable' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <nav className={navigationClasses} role="tablist" aria-label="Navegación principal">
      {/* Flecha izquierda para scroll */}
      {scrollable && orientation === 'horizontal' && showLeftArrow && (
        <button
          type="button"
          className="tab-scroll-arrow tab-scroll-arrow-left"
          onClick={() => scrollTabs('left')}
          aria-label="Scroll hacia la izquierda"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
        </button>
      )}

      {/* Contenedor de tabs */}
      <div className="tab-navigation-container" ref={tabsRef}>
        <div className="tab-navigation-list">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const tabClasses = [
              'tab-navigation-item',
              isActive ? 'tab-navigation-item-active' : '',
              tab.disabled ? 'tab-navigation-item-disabled' : '',
              showDescriptions ? 'tab-navigation-item-with-description' : ''
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={tab.id}
                ref={isActive ? activeTabRef : null}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-disabled={tab.disabled}
                aria-describedby={showDescriptions ? `${tab.id}-description` : undefined}
                className={tabClasses}
                onClick={() => handleTabClick(tab.id, tab.disabled)}
                onKeyDown={(e) => handleKeyDown(e, tab.id, tab.disabled)}
                disabled={tab.disabled}
                tabIndex={isActive ? 0 : -1}
              >
                <div className="tab-navigation-content">
                  <div className="tab-navigation-header">
                    <span className="tab-navigation-icon">{tab.icon}</span>
                    <span className="tab-navigation-label">{tab.label}</span>
                    {tab.badge && (
                      <span className="tab-navigation-badge">{tab.badge}</span>
                    )}
                  </div>
                  
                  {showDescriptions && tab.description && (
                    <p 
                      id={`${tab.id}-description`}
                      className="tab-navigation-description"
                    >
                      {tab.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Indicador de tab activa (solo horizontal) */}
        {orientation === 'horizontal' && (
          <div 
            className="tab-navigation-indicator"
            style={indicatorStyle}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Flecha derecha para scroll */}
      {scrollable && orientation === 'horizontal' && showRightArrow && (
        <button
          type="button"
          className="tab-scroll-arrow tab-scroll-arrow-right"
          onClick={() => scrollTabs('right')}
          aria-label="Scroll hacia la derecha"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </button>
      )}
    </nav>
  );
};

// Hook para gestionar el estado de las tabs
export const useTabNavigation = (initialTab: TabName = 'project-data') => {
  const [activeTab, setActiveTab] = useState<TabName>(initialTab);
  const [visitedTabs, setVisitedTabs] = useState<TabName[]>([initialTab]);
  const [tabErrors, setTabErrors] = useState<TabErrors>({});

  const switchTab = (tabName: TabName) => {
    setActiveTab(tabName);
    setVisitedTabs(prev => {
      if (!prev.includes(tabName)) {
        return [...prev, tabName];
      }
      return prev;
    });
  };

  const setTabError = (tabName: TabName, hasError: boolean) => {
    setTabErrors(prev => ({
      ...prev,
      [tabName]: hasError
    }));
  };

  const getNextTab = (): TabName | null => {
    const tabs = defaultTabs.map(tab => tab.id);
    const currentIndex = tabs.indexOf(activeTab);
    return currentIndex < tabs.length - 1 ? tabs[currentIndex + 1] : null;
  };

  const getPreviousTab = (): TabName | null => {
    const tabs = defaultTabs.map(tab => tab.id);
    const currentIndex = tabs.indexOf(activeTab);
    return currentIndex > 0 ? tabs[currentIndex - 1] : null;
  };

  const goToNextTab = () => {
    const nextTab = getNextTab();
    if (nextTab) switchTab(nextTab);
  };

  const goToPreviousTab = () => {
    const previousTab = getPreviousTab();
    if (previousTab) switchTab(previousTab);
  };

  const hasVisitedTab = (tabName: TabName): boolean => {
    return visitedTabs.includes(tabName);
  };

  const hasTabError = (tabName: TabName): boolean => {
    return Boolean(tabErrors[tabName]);
  };

  const clearTabError = (tabName: TabName) => {
    setTabErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[tabName];
      return newErrors;
    });
  };

  const clearAllErrors = () => {
    setTabErrors({});
  };

  return {
    activeTab,
    visitedTabs,
    tabErrors,
    switchTab,
    setTabError,
    hasTabError,
    clearTabError,
    clearAllErrors,
    getNextTab,
    getPreviousTab,
    goToNextTab,
    goToPreviousTab,
    hasVisitedTab,
    isFirstTab: activeTab === defaultTabs[0].id,
    isLastTab: activeTab === defaultTabs[defaultTabs.length - 1].id
  };
};

// Componente de navegación simplificada para casos específicos
export const SimpleTabNavigation: React.FC<{
  tabs: { id: string; label: string; icon?: React.ReactNode }[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="simple-tab-navigation">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`simple-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.icon && <span className="simple-tab-icon">{tab.icon}</span>}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

export default TabNavigation;