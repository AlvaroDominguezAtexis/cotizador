import React from 'react';
import { Header } from './Header';
import { TabName } from '../../types/common';
import './Layout.css';

interface LayoutProps {
  /** Usuario actualmente logueado */
  user: string | null;
  /** Función para cerrar sesión */
  onLogout: () => void;
  /** Tab actualmente activo */
  activeTab: TabName;
  /** Función para cambiar de tab */
  onTabChange: (tab: TabName) => void;
  /** Contenido principal a renderizar */
  children: React.ReactNode;
  /** Clases CSS adicionales */
  className?: string;
}

export const Layout: React.FC<LayoutProps> = ({
  user,
  onLogout,
  activeTab,
  onTabChange,
  children,
  className = ''
}) => {
  const layoutClasses = [
    'layout',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={layoutClasses}>
      {/* Header con información del usuario y logout */}
      <Header 
        user={user}
        onLogout={onLogout}
      />

      {/* Gap between header and tabs */}
      <div style={{ marginBottom: 18 }} />

      {/* Contenedor principal */}
      <main className="layout-main">
        <div className="layout-container">



          {/* Contenido de la tab activa */}
          <div className="layout-content">
            <div className="layout-content-inner">
              {children}
            </div>
          </div>
        </div>
      </main>

      {/* Footer opcional */}
      <footer className="layout-footer">
        <div className="layout-container">
          <div className="layout-footer-content">
            <p className="layout-footer-text">
              © 2024 Quotation System - Version 1.0.0
            </p>
            <div className="layout-footer-links">
              <button 
                type="button" 
                className="layout-footer-link"
                onClick={() => window.open('/help', '_blank')}
              >
                Help
              </button>
              <button 
                type="button" 
                className="layout-footer-link"
                onClick={() => window.open('/docs', '_blank')}
              >
                Documentation
              </button>
              <button 
                type="button" 
                className="layout-footer-link"
                onClick={() => window.open('/support', '_blank')}
              >
                Support
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Hook para detectar si el usuario está en móvil
export const useIsMobile = () => {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Check inicial
    checkMobile();

    // Listener para cambios de tamaño
    window.addEventListener('resize', checkMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

// Hook para gestionar el scroll del layout
export const useLayoutScroll = () => {
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setIsScrolled(scrollTop > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return isScrolled;
};

// Variante compacta del layout para casos específicos
export const CompactLayout: React.FC<Pick<LayoutProps, 'children' | 'className'>> = ({
  children,
  className = ''
}) => {
  const layoutClasses = [
    'layout',
    'layout-compact',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={layoutClasses}>
      <main className="layout-main">
        <div className="layout-container">
          <div className="layout-content">
            <div className="layout-content-inner">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// Layout para modales y overlays
export const ModalLayout: React.FC<{
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}> = ({
  children,
  isOpen,
  onClose,
  title,
  size = 'md'
}) => {
  // Prevenir scroll del body cuando el modal está abierto
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Cerrar con ESC
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-layout-overlay" onClick={onClose}>
      <div 
        className={`modal-layout-container modal-layout-${size}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {title && (
          <div className="modal-layout-header">
            <h2 id="modal-title" className="modal-layout-title">
              {title}
            </h2>
            <button
              type="button"
              className="modal-layout-close"
              onClick={onClose}
              aria-label="Cerrar modal"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        )}
        
        <div className="modal-layout-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;