import React from 'react';
import './LoadingSpinner.css';

export type SpinnerSize = 'small' | 'medium' | 'large' | 'xlarge';
export type SpinnerVariant = 'primary' | 'secondary' | 'white' | 'light';

interface LoadingSpinnerProps {
  /** Tamaño del spinner */
  size?: SpinnerSize;
  /** Variante de color */
  variant?: SpinnerVariant;
  /** Texto a mostrar debajo del spinner */
  text?: string;
  /** Mostrar en el centro de la pantalla */
  fullScreen?: boolean;
  /** Mostrar con overlay de fondo */
  overlay?: boolean;
  /** Clases CSS adicionales */
  className?: string;
  /** Velocidad de animación */
  speed?: 'slow' | 'normal' | 'fast';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  variant = 'primary',
  text,
  fullScreen = false,
  overlay = false,
  className = '',
  speed = 'normal'
}) => {
  const spinnerClasses = [
    'loading-spinner',
    `loading-spinner-${size}`,
    `loading-spinner-${variant}`,
    `loading-spinner-${speed}`,
    fullScreen ? 'loading-spinner-fullscreen' : '',
    overlay ? 'loading-spinner-overlay' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  const SpinnerSVG = () => (
    <svg className="spinner-svg" viewBox="0 0 50 50">
      <circle
        className="spinner-circle"
        cx="25"
        cy="25"
        r="20"
        fill="none"
        strokeWidth="4"
      />
    </svg>
  );

  const DotsSpinner = () => (
    <div className="dots-spinner">
      <div className="dot dot-1"></div>
      <div className="dot dot-2"></div>
      <div className="dot dot-3"></div>
    </div>
  );

  const PulseSpinner = () => (
    <div className="pulse-spinner">
      <div className="pulse-circle pulse-1"></div>
      <div className="pulse-circle pulse-2"></div>
      <div className="pulse-circle pulse-3"></div>
    </div>
  );

  if (fullScreen || overlay) {
    return (
      <div className={spinnerClasses} role="status" aria-label="Cargando">
        <div className="spinner-content">
          <SpinnerSVG />
          {text && <p className="spinner-text">{text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={spinnerClasses} role="status" aria-label="Cargando">
      <SpinnerSVG />
      {text && <p className="spinner-text">{text}</p>}
    </div>
  );
};

// Componentes específicos pre-configurados
export const SmallSpinner: React.FC<Omit<LoadingSpinnerProps, 'size'>> = (props) => (
  <LoadingSpinner size="small" {...props} />
);

export const LargeSpinner: React.FC<Omit<LoadingSpinnerProps, 'size'>> = (props) => (
  <LoadingSpinner size="large" {...props} />
);

export const FullScreenSpinner: React.FC<Omit<LoadingSpinnerProps, 'fullScreen'>> = (props) => (
  <LoadingSpinner fullScreen {...props} />
);

export const OverlaySpinner: React.FC<Omit<LoadingSpinnerProps, 'overlay'>> = (props) => (
  <LoadingSpinner overlay {...props} />
);

// Spinner de dots
export const DotsLoader: React.FC<Pick<LoadingSpinnerProps, 'size' | 'variant' | 'className'>> = ({
  size = 'medium',
  variant = 'primary',
  className = ''
}) => {
  const classes = [
    'dots-loader',
    `dots-loader-${size}`,
    `dots-loader-${variant}`,
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role="status" aria-label="Cargando">
      <div className="dots-spinner">
        <div className="dot dot-1"></div>
        <div className="dot dot-2"></div>
        <div className="dot dot-3"></div>
      </div>
    </div>
  );
};

// Spinner de pulso
export const PulseLoader: React.FC<Pick<LoadingSpinnerProps, 'size' | 'variant' | 'className'>> = ({
  size = 'medium',
  variant = 'primary',
  className = ''
}) => {
  const classes = [
    'pulse-loader',
    `pulse-loader-${size}`,
    `pulse-loader-${variant}`,
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role="status" aria-label="Cargando">
      <div className="pulse-spinner">
        <div className="pulse-circle pulse-1"></div>
        <div className="pulse-circle pulse-2"></div>
        <div className="pulse-circle pulse-3"></div>
      </div>
    </div>
  );
};

// Spinner lineal (barra de progreso)
export const LinearSpinner: React.FC<{
  progress?: number;
  variant?: SpinnerVariant;
  className?: string;
  showPercentage?: boolean;
}> = ({ 
  progress, 
  variant = 'primary', 
  className = '',
  showPercentage = false 
}) => {
  const classes = [
    'linear-spinner',
    `linear-spinner-${variant}`,
    className
  ]
    .filter(Boolean)
    .join(' ');

  const isIndeterminate = progress === undefined;

  return (
    <div className={classes} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
      <div className="linear-spinner-track">
        <div 
          className={`linear-spinner-bar ${isIndeterminate ? 'indeterminate' : ''}`}
          style={!isIndeterminate ? { width: `${progress}%` } : undefined}
        />
      </div>
      {showPercentage && !isIndeterminate && (
        <span className="linear-spinner-percentage">{Math.round(progress)}%</span>
      )}
    </div>
  );
};

// Hook para gestionar estados de carga
export const useLoading = (initialState = false) => {
  const [isLoading, setIsLoading] = React.useState(initialState);
  const [progress, setProgress] = React.useState<number | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);

  const startLoading = React.useCallback((showProgress = false) => {
    setIsLoading(true);
    setError(null);
    if (showProgress) {
      setProgress(0);
    }
  }, []);

  const stopLoading = React.useCallback(() => {
    setIsLoading(false);
    setProgress(undefined);
  }, []);

  const updateProgress = React.useCallback((newProgress: number) => {
    setProgress(Math.max(0, Math.min(100, newProgress)));
  }, []);

  const setLoadingError = React.useCallback((errorMessage: string) => {
    setError(errorMessage);
    setIsLoading(false);
    setProgress(undefined);
  }, []);

  const withLoading = React.useCallback(async <T,>(
    asyncFn: () => Promise<T>,
    showProgress = false
  ): Promise<T | null> => {
    try {
      startLoading(showProgress);
      const result = await asyncFn();
      stopLoading();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setLoadingError(message);
      return null;
    }
  }, [startLoading, stopLoading, setLoadingError]);

  return {
    isLoading,
    progress,
    error,
    startLoading,
    stopLoading,
    updateProgress,
    setLoadingError,
    withLoading
  };
};

export default LoadingSpinner;