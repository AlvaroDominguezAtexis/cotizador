// types/common.ts

// Definición de los nombres de las tabs disponibles
export type TabName = 
  | 'project-data' 
  | 'profiles' 
  | 'work-packages' 
  | 'non-operational-costs' 
  | 'summary'
  | 'advance-settings';

// Interfaz base para props de modales
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Información de países
export interface Country {
  code: string;
  name: string;
  flag?: string;
}

// Lista de países disponibles
export const COUNTRIES: Country[] = [
  { code: 'españa', name: 'España', flag: '🇪🇸' },
  { code: 'francia', name: 'Francia', flag: '🇫🇷' },
  { code: 'india', name: 'India', flag: '🇮🇳' },
];

// Business Managers disponibles
export interface BusinessManager {
  id: string;
  name: string;
  email?: string;
}

export const BUSINESS_MANAGERS: BusinessManager[] = [
  { id: 'ana_garcia', name: 'Ana García', email: 'ana.garcia@empresa.com' },
  { id: 'carlos_lopez', name: 'Carlos López', email: 'carlos.lopez@empresa.com' },
  { id: 'maria_rodriguez', name: 'María Rodríguez', email: 'maria.rodriguez@empresa.com' },
  { id: 'juan_martinez', name: 'Juan Martínez', email: 'juan.martinez@empresa.com' },
];

// Business Units disponibles
export interface BusinessUnit {
  id: string;
  name: string;
  description?: string;
}

export const BUSINESS_UNITS: BusinessUnit[] = [
  { id: 'desarrollo', name: 'Desarrollo', description: 'Desarrollo de software y aplicaciones' },
  { id: 'consultoria', name: 'Consultoría', description: 'Servicios de consultoría IT' },
  { id: 'infraestructura', name: 'Infraestructura', description: 'Gestión de infraestructura IT' },
  { id: 'datos', name: 'Datos y Analytics', description: 'Análisis de datos y BI' },
];

// Ops Domains disponibles
export interface OpsDomain {
  id: string;
  name: string;
  color?: string;
}

export const OPS_DOMAINS: OpsDomain[] = [
  { id: 'frontend', name: 'Frontend', color: '#61dafb' },
  { id: 'backend', name: 'Backend', color: '#339933' },
  { id: 'devops', name: 'DevOps', color: '#326ce5' },
  { id: 'ux_ui', name: 'UX/UI', color: '#ff6b6b' },
  { id: 'data_science', name: 'Data Science', color: '#ff9f43' },
  { id: 'mobile', name: 'Mobile', color: '#a55eea' },
];

// Tipos de segmentación
export type SEGMENTATION_OPTIONS= 'New Business' | 'Recurrent';

// Tipos de alcance de proyecto
export type ProjectScope = 'local' | 'transnational';

// IQP levels
export type IQP_OPTIONS = '1' | '2' | '3' | '4' | '5';

// Unidades de tiempo para steps
export type TimeUnit = 'horas' | 'dias' | 'meses';

// Estados de validación
export type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

// Tipos de notificación
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

// Interfaz para notificaciones
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  autoClose?: boolean;
}

// Estados de carga
export interface LoadingState {
  isLoading: boolean;
  error?: string | null;
  progress?: number;
}

// Interfaz base para entidades con ID
export interface BaseEntity {
  id: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Configuración de paginación
export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
}

// Configuración de ordenamiento
export interface SortConfig<T = string> {
  key: T;
  direction: 'asc' | 'desc';
}

// Filtros base
export interface BaseFilters {
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// Configuración de exportación
export interface ExportConfig {
  format: 'pdf' | 'excel' | 'csv';
  includeCharts?: boolean;
  includeDetails?: boolean;
  fileName?: string;
}

// Información de sesión de usuario
export interface UserSession {
  user: string;
  loginTime: Date;
  lastActivity: Date;
  permissions?: string[];
}

// Configuración de tema
export interface ThemeConfig {
  mode: 'light' | 'dark' | 'auto';
  primaryColor?: string;
  accentColor?: string;
}

// Configuración de accesibilidad
export interface AccessibilityConfig {
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large';
  screenReader: boolean;
}

// Configuración general de la aplicación
export interface AppConfig {
  theme: ThemeConfig;
  accessibility: AccessibilityConfig;
  language: string;
  autoSave: boolean;
  notifications: boolean;
}

// Tipos para manejo de errores
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// Tipos para validación de formularios
export interface FieldError {
  field: string;
  message: string;
  type: 'required' | 'invalid' | 'min' | 'max' | 'pattern';
}

export interface FormValidation {
  isValid: boolean;
  errors: FieldError[];
  warnings?: FieldError[];
}

// Utilidades de tipo
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Tipo para funciones de callback genéricas
export type CallbackFunction<T = void> = (data?: T) => void;
export type AsyncCallbackFunction<T = void> = (data?: T) => Promise<void>;

// Tipo para componentes React con children opcionales
export type ReactComponent<P = {}> = React.FC<P & { children?: React.ReactNode }>;

// Tipo para refs de elementos HTML comunes
export type HTMLElementRef<T extends HTMLElement = HTMLElement> = React.RefObject<T>;

// Constantes útiles
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const SUPPORTED_FILE_TYPES = ['pdf', 'doc', 'docx', 'xls', 'xlsx'] as const;

// Regex patterns comunes
export const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\+]?[0-9\s\-\(\)]{10,}$/,
  url: /^https?:\/\/.+/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  projectCode: /^[A-Z]{2,4}-\d{4}-\d{3}$/,
} as const;

// Mensajes de error comunes
export const ERROR_MESSAGES = {
  required: 'Este campo es requerido',
  invalid_email: 'Email inválido',
  invalid_phone: 'Teléfono inválido',
  invalid_url: 'URL inválida',
  min_length: (min: number) => `Mínimo ${min} caracteres`,
  max_length: (max: number) => `Máximo ${max} caracteres`,
  file_too_large: `El archivo es demasiado grande (máximo ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
  unsupported_file: `Tipo de archivo no soportado. Use: ${SUPPORTED_FILE_TYPES.join(', ')}`,
} as const;

// Configuraciones por defecto
export const DEFAULT_CONFIG: AppConfig = {
  theme: {
    mode: 'light',
    primaryColor: '#0070CE',
    accentColor: '#FF8300',
  },
  accessibility: {
    highContrast: false,
    reducedMotion: false,
    fontSize: 'medium',
    screenReader: false,
  },
  language: 'es',
  autoSave: true,
  notifications: true,
};

// Tipo para el estado global de la aplicación
export interface AppState {
  user: UserSession | null;
  config: AppConfig;
  notifications: Notification[];
  loading: LoadingState;
  errors: AppError[];
}

// Helper para crear tipos de Record más flexibles
export type PartialRecord<K extends keyof any, T> = Partial<Record<K, T>>;

// Tipo para errores de tabs (solución al problema original)
export type TabErrors = PartialRecord<TabName, boolean>;