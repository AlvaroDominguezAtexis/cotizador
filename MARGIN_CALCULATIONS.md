# Sistema de Cálculo de Márgenes

## 📊 Función `calculateMarginsWithGivenTO`

### Propósito
Esta función permite calcular **DM** (Direct Margin) y **GMBS** (Gross Margin Before Sales) utilizando un **TO** (Turnover) dado como input, en lugar de calcularlo desde los steps.

### Casos de Uso
- Análisis "what-if" con diferentes valores de TO
- Cálculo de márgenes cuando el TO viene de fuentes externas
- Validación de márgenes con TO manuales o ajustados

## 🔧 Implementación

### Backend (Referencia)
Los cálculos base están implementados en:
- `backend/src/services/deliverables/marginsYearly.ts`
- Función `calcBulkMargins()` - cálculo completo con TO calculado
- Lógica de costos operacionales y no operacionales

### Frontend (Utilidad)
Nueva función implementada en:
- `frontend/src/utils/marginCalculations.ts`
- `calculateMarginsWithGivenTO()` - función completa con breakdown de steps
- `calculateMarginsSimple()` - versión simplificada para cálculos rápidos

## 📐 Fórmulas de Cálculo

### Costos por Step
```typescript
// OPERATIONAL COSTS: (base_costs × quantity × activity_rate)
operationalCosts = (salaries + management + npt + it + premises) × quantity × (activity_rate/100)

// NON-OPERATIONAL COSTS: (direct sum, sin quantity multiplier)
nonOperationalCosts = it_recurrent + travel + subco + purchases
```

### Costos Agregados
```typescript
// DM COSTS: Costos operacionales ajustados + no operacionales
totalDmCosts = operationalCosts + nonOperationalCosts

// GMBS COSTS: Costos operacionales base + no operacionales  
totalGmbsCosts = operationalBase + nonOperationalCosts
```

### Márgenes Finales
```typescript
// DM = (TO - DM_costs) / TO × 100
DM = ((givenTO - totalDmCosts) / givenTO) × 100

// GMBS = (TO - GMBS_costs) / TO × 100
GMBS = ((givenTO - totalGmbsCosts) / givenTO) × 100
```

## 🎯 Uso en Summary Tab

### Integración Actual
En `SummaryDocument.tsx`:
1. **Fetch de datos**: `deliverables-costs-breakdown` endpoint
2. **Recálculo**: `recalculateWorkpackageMargins()` usando TO existente
3. **Display**: Mostrar DM y GMBS recalculados en lugar de valores originales

### Flujo de Datos
```
Backend → Raw TO + Costs → Frontend Recalc → Display
```

## 🔍 Ejemplo de Uso

```typescript
import { calculateMarginsSimple } from '../utils/marginCalculations';

// Caso simple: TO conocido, costos calculados
const result = calculateMarginsSimple({
  givenTO: 100000,      // €100k TO
  totalDmCosts: 70000,  // €70k costos DM
  totalGmbsCosts: 75000 // €75k costos GMBS
});

// Resultado: { TO: 100000, DM: 30, GMBS: 25 }
```

## 🚀 Beneficios

1. **Flexibilidad**: TO puede venir de cualquier fuente
2. **Consistencia**: Usa las mismas fórmulas que el backend
3. **Performance**: Cálculo local sin round-trips al servidor
4. **Debugging**: Logs detallados del proceso de cálculo

## ⚠️ Consideraciones

- La función asume que los costos de input ya están correctamente calculados
- Activity rates y quantities deben ser consistentes con el backend
- Para análisis precisos, usar la función completa con breakdown de steps