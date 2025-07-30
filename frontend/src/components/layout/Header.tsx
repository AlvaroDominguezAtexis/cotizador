import React, { useState } from 'react';
import { Button } from '../ui/Button';
import logoImage from '../../assets/images/atexis_logo.svg'; // Adjust path as needed
import './Header.css';

interface HeaderProps {
  /** Usuario actualmente logueado */
  user: string | null;
  /** Función para cerrar sesión */
  onLogout: () => void;
  /** Título personalizado (opcional) */
  title?: string;
  /** Mostrar información del proyecto en el header */
  projectInfo?: {
    title: string;
    code: string;
    client: string;
  };
  /** Acciones adicionales en el header */
  actions?: React.ReactNode;
  /** Clases CSS adicionales */
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  title = 'Sistema de Cotizaciones',
  projectInfo,
  actions,
  className = ''
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const headerClasses = [
    'header',
    className
  ]
    .filter(Boolean)
    .join(' ');

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
    setShowUserMenu(false);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  // Cerrar menú al hacer clic fuera
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.header-user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showUserMenu]);

  return (
    <>
      <header className={headerClasses}>
        <div className="header-container">
          {/* Logo */}
          <div className="header-logo">
            <img 
              src={logoImage} 
              alt="ATEDCIS Logo" 
              className="header-logo-icon" 
            />
          </div>
          
          {/* Título centrado */}
          <div className="header-title-section">
            <h1 className="header-title">{title}</h1>
          </div>

          {/* Área de acciones */}
          <div className="header-actions">
            {/* Información del usuario y menú */}
            <div className="header-user-section">
              {user && (
                <div className="header-user-menu-container">
                  <button
                    type="button"
                    className="header-user-button"
                    onClick={toggleUserMenu}
                    aria-expanded={showUserMenu}
                    aria-haspopup="true"
                    aria-label={`Menú de usuario ${user}`}
                  >
                    <div className="header-user-avatar">
                      <span className="header-user-initials">
                        {user.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="header-user-info">
                      <span className="header-user-name">{user}</span>
                      <span className="header-user-role">Administrador</span>
                    </div>
                    <svg 
                      className={`header-user-chevron ${showUserMenu ? 'rotated' : ''}`}
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor"
                    >
                      <polyline points="6,9 12,15 18,9"/>
                    </svg>
                  </button>

                  {/* Menú desplegable del usuario */}
                  {showUserMenu && (
                    <div className="header-user-menu" role="menu">
                      <div className="header-user-menu-header">
                        <div className="header-user-menu-avatar">
                          <span className="header-user-menu-initials">
                            {user.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="header-user-menu-info">
                          <div className="header-user-menu-name">{user}</div>
                          <div className="header-user-menu-email">admin@empresa.com</div>
                        </div>
                      </div>

                      <div className="header-user-menu-divider" />

                      <div className="header-user-menu-items">
                        <button 
                          type="button"
                          className="header-user-menu-item"
                          role="menuitem"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                          Mi Perfil
                        </button>

                        <button 
                          type="button"
                          className="header-user-menu-item"
                          role="menuitem"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                          </svg>
                          Configuración
                        </button>

                        <button 
                          type="button"
                          className="header-user-menu-item"
                          role="menuitem"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                            <path d="M12 17h.01"/>
                          </svg>
                          Ayuda
                        </button>

                        <div className="header-user-menu-divider" />

                        <button 
                          type="button"
                          className="header-user-menu-item header-user-menu-item-danger"
                          onClick={handleLogoutClick}
                          role="menuitem"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16,17 21,12 16,7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                          </svg>
                          Cerrar Sesión
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Modal de confirmación de logout */}
      {showLogoutConfirm && (
        <div className="logout-confirm-overlay">
          <div className="logout-confirm-modal" role="dialog" aria-modal="true">
            <div className="logout-confirm-header">
              <h3 className="logout-confirm-title">Cerrar Sesión</h3>
            </div>
            
            <div className="logout-confirm-content">
              <p>¿Estás seguro de que quieres cerrar sesión?</p>
              <p className="logout-confirm-warning">
                Se perderán los cambios no guardados.
              </p>
            </div>
            
            <div className="logout-confirm-actions">
              <Button
                variant="secondary"
                onClick={cancelLogout}
                className="logout-confirm-cancel"
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={confirmLogout}
                className="logout-confirm-confirm"
              >
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Hook para obtener la hora actual y saludar apropiadamente
export const useGreeting = () => {
  const [greeting, setGreeting] = useState('');

  React.useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      
      if (hour < 12) {
        setGreeting('Buenos días');
      } else if (hour < 18) {
        setGreeting('Buenas tardes');
      } else {
        setGreeting('Buenas noches');
      }
    };

    updateGreeting();
    
    // Actualizar cada minuto
    const interval = setInterval(updateGreeting, 60000);
    
    return () => clearInterval(interval);
  }, []);

  return greeting;
};

// Componente Header simplificado para casos específicos
export const SimpleHeader: React.FC<{
  title: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}> = ({ title, onBack, actions }) => {
  return (
    <header className="header header-simple">
      <div className="header-container">
        <div className="header-simple-left">
          {onBack && (
            <button
              type="button"
              className="header-back-button"
              onClick={onBack}
              aria-label="Volver"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="15,18 9,12 15,6"/>
              </svg>
            </button>
          )}
          <h1 className="header-simple-title">{title}</h1>
        </div>
        
        {actions && (
          <div className="header-simple-actions">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;