# Test Files Audit and Migration Mapping

## Overview
This document maps all existing test files in the project and their proposed migration to the standardized structure.

## Current Issues Identified
1. **Multiple test locations**: Tests scattered across root `./tests`, `packages/backend/tests`, and `packages/backend/src/**/__tests__`
2. **Mixed file types**: Both `.js` and `.ts` test files exist
3. **Inconsistent structure**: No clear organization pattern
4. **Duplicate tests**: Some tests exist in multiple locations

## Current Test File Locations

### Root Level Tests Directory (`./tests/`)
**Status**: TO BE ELIMINATED - All files need migration

| Current Location | File Type | Dependencies | Target Location | Notes |
|------------------|-----------|--------------|-----------------|-------|
| `tests/e2e/trading/engine/standalone-engine.test.ts` | TS | Backend trading engine | `packages/backend/tests/e2e/trading/engine/` | E2E test |
| `tests/e2e/trading/trading-engine.test.ts` | TS | Backend trading engine | `packages/backend/tests/e2e/trading/` | E2E test |
| `tests/integration/backend/strategies/strategy-factory.test.ts` | TS | Backend strategy factory | `packages/backend/tests/integration/strategies/` | Integration test |
| `tests/unit/backend/indicators/atr-indicator.test.ts` | TS | Backend ATR indicator | `packages/backend/tests/unit/indicators/` | Unit test |
| `tests/unit/backend/indicators/ema-indicator.test.ts` | TS | Backend EMA indicator | `packages/backend/tests/unit/indicators/` | Unit test |
| `tests/unit/backend/indicators/rsi-indicator.test.ts` | TS | Backend RSI indicator | `packages/backend/tests/unit/indicators/` | Unit test |
| `tests/unit/backend/indicators/sma-indicator.test.ts` | TS | Backend SMA indicator | `packages/backend/tests/unit/indicators/` | Unit test |
| `tests/unit/backend/JabbrLabs/signals/sma/sma-crossover-strategy.test.ts` | TS | Backend SMA strategy | `packages/backend/tests/unit/JabbrLabs/signals/sma/` | Unit test |
| `tests/unit/backend/JabbrLabs/signals/sma/sma-signal-processor.test.ts` | TS | Backend SMA processor | `packages/backend/tests/unit/JabbrLabs/signals/sma/` | Unit test |
| `tests/unit/shared/validation.test.ts` | TS | Shared validation | `packages/shared/tests/unit/` | Unit test |

### Backend Package Tests (`packages/backend/tests/`)
**Status**: NEEDS ORGANIZATION - Mix of proper tests and debug files

| Current Location | File Type | Category | Action | Target Location | Notes |
|------------------|-----------|----------|--------|-----------------|-------|
| `packages/backend/tests/JabbrLabs/signals/sma/improved-sma-signal-processor.test.ts` | TS | Unit Test | KEEP | Same location | ✅ Already in correct location |
| `packages/backend/tests/JabbrLabs/signals/sma/sma-crossover-strategy.test.ts` | TS | Unit Test | DUPLICATE | Remove | Duplicate of root test |
| `packages/backend/tests/JabbrLabs/signals/sma/sma-signal-processor.test.ts` | TS | Unit Test | DUPLICATE | Remove | Duplicate of root test |
| `packages/backend/tests/strategies/strategy-factory.test.ts` | TS | Unit Test | DUPLICATE | Remove | Duplicate of root test |
| `packages/backend/tests/test-strategy-framework.js` | JS | Test | CONVERT | `packages/backend/tests/unit/` | Convert to TS |

### Backend Source Tests (`packages/backend/src/**/__tests__/`)
**Status**: TO BE MOVED - Tests embedded in source

| Current Location | File Type | Dependencies | Target Location | Notes |
|------------------|-----------|--------------|-----------------|-------|
| `packages/backend/src/JabbrLabs/indicators/__tests__/atr-indicator.test.ts` | TS | ATR indicator | `packages/backend/tests/unit/indicators/` | Unit test |
| `packages/backend/src/JabbrLabs/indicators/__tests__/ema-indicator.test.ts` | TS | EMA indicator | `packages/backend/tests/unit/indicators/` | Unit test |
| `packages/backend/src/JabbrLabs/indicators/__tests__/rsi-indicator.test.ts` | TS | RSI indicator | `packages/backend/tests/unit/indicators/` | Unit test |
| `packages/backend/src/JabbrLabs/indicators/__tests__/sma-indicator.test.ts` | TS | SMA indicator | `packages/backend/tests/unit/indicators/` | Unit test |

### Backend Debug/Utility Files (NOT Tests)
**Status**: TO BE ORGANIZED - These are debug/utility scripts, not tests

| Current Location | File Type | Purpose | Target Location | Notes |
|------------------|-----------|---------|-----------------|-------|
| `packages/backend/tests/compare-sma-processors.ts` | TS | Debug script | `packages/backend/scripts/debug/` | Not a test |
| `packages/backend/tests/debug-sma-processor.ts` | TS | Debug script | `packages/backend/scripts/debug/` | Not a test |
| `packages/backend/tests/debug-sma-signals.ts` | TS | Debug script | `packages/backend/scripts/debug/` | Not a test |
| `packages/backend/tests/fixed-sma-backtest.ts` | TS | Backtest script | `packages/backend/scripts/backtest/` | Not a test |
| `packages/backend/tests/run-sma-test.ts` | TS | Test runner | `packages/backend/scripts/test/` | Not a test |
| `packages/backend/tests/simple-sma-debug.ts` | TS | Debug script | `packages/backend/scripts/debug/` | Not a test |
| `packages/backend/tests/sma-backtest.ts` | TS | Backtest script | `packages/backend/scripts/backtest/` | Not a test |
| `packages/backend/tests/test-engine-standalone.ts` | TS | Debug script | `packages/backend/scripts/debug/` | Not a test |
| `packages/backend/tests/test-futures-beast.ts` | TS | Debug script | `packages/backend/scripts/debug/` | Not a test |
| `packages/backend/tests/test-futures-position-modify.ts` | TS | Debug script | `packages/backend/scripts/debug/` | Not a test |
| `packages/backend/tests/test-live-order.ts` | TS | Debug script | `packages/backend/scripts/debug/` | Not a test |
| `packages/backend/tests/test-mainnet-small.ts` | TS | Debug script | `packages/backend/scripts/debug/` | Not a test |
| `packages/backend/tests/test-market-data.ts` | TS | Debug script | `packages/backend/scripts/debug/` | Not a test |
| `packages/backend/tests/test-sma-backtest.ts` | TS | Debug script | `packages/backend/scripts/debug/` | Not a test |
| `packages/backend/tests/test-sma-signals.ts` | TS | Debug script | `packages/backend/scripts/debug/` | Not a test |
| `packages/backend/tests/test-trading-engine.ts` | TS | Debug script | `packages/backend/scripts/debug/` | Not a test |
| `packages/backend/tests/verify-order.ts` | TS | Debug script | `packages/backend/scripts/debug/` | Not a test |

## Proposed Target Structure

### Backend Tests (`packages/backend/tests/`)
```
packages/backend/tests/
├── unit/
│   ├── indicators/
│   │   ├── atr-indicator.test.ts
│   │   ├── ema-indicator.test.ts
│   │   ├── rsi-indicator.test.ts
│   │   └── sma-indicator.test.ts
│   ├── JabbrLabs/
│   │   └── signals/
│   │       └── sma/
│   │           ├── improved-sma-signal-processor.test.ts
│   │           ├── sma-crossover-strategy.test.ts
│   │           └── sma-signal-processor.test.ts
│   ├── strategies/
│   │   └── strategy-factory.test.ts
│   ├── services/
│   │   ├── monitoring.test.ts (NEW)
│   │   ├── system-monitor.test.ts (NEW)
│   │   └── alert-manager.test.ts (NEW)
│   └── utils/
│       └── strategy-framework.test.ts (converted from JS)
├── integration/
│   ├── strategies/
│   │   └── strategy-factory.test.ts
│   ├── trading/
│   │   └── trading-engine.test.ts
│   └── exchanges/
│       └── exchange-integration.test.ts (NEW)
├── e2e/
│   └── trading/
│       ├── trading-engine.test.ts
│       └── engine/
│           └── standalone-engine.test.ts
└── fixtures/
    ├── sample-data.ts
    └── test-helpers.ts
```

### Frontend Tests (`packages/frontend/tests/`) - TO BE CREATED
```
packages/frontend/tests/
├── unit/
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   └── pages/
├── integration/
│   └── api/
├── e2e/
│   └── user-flows/
└── fixtures/
    └── mock-data.ts
```

### Shared Tests (`packages/shared/tests/`) - TO BE CREATED
```
packages/shared/tests/
├── unit/
│   ├── validation.test.ts (moved from root)
│   ├── types.test.ts (NEW)
│   └── utils.test.ts (NEW)
└── fixtures/
    └── test-data.ts
```

### Scripts Directory (`packages/backend/scripts/`) - TO BE CREATED
```
packages/backend/scripts/
├── debug/
│   ├── compare-sma-processors.ts
│   ├── debug-sma-processor.ts
│   ├── debug-sma-signals.ts
│   ├── simple-sma-debug.ts
│   ├── test-engine-standalone.ts
│   ├── test-futures-beast.ts
│   ├── test-futures-position-modify.ts
│   ├── test-live-order.ts
│   ├── test-mainnet-small.ts
│   ├── test-market-data.ts
│   ├── test-sma-signals.ts
│   ├── test-trading-engine.ts
│   └── verify-order.ts
├── backtest/
│   ├── fixed-sma-backtest.ts
│   ├── sma-backtest.ts
│   └── test-sma-backtest.ts
└── test/
    └── run-sma-test.ts
```

## Migration Steps Summary

1. **Create target directories** in each package
2. **Move actual test files** to proper locations
3. **Move debug/utility scripts** to scripts directory
4. **Convert JavaScript files** to TypeScript
5. **Remove duplicate files**
6. **Update import paths** in all moved files
7. **Update Jest configurations** to point to new test directories
8. **Remove empty root-level tests directory**
9. **Validate all tests still pass**

## Files to Convert (JS → TS)

1. `packages/backend/tests/test-strategy-framework.js` → `packages/backend/tests/unit/utils/strategy-framework.test.ts`

## Files to Remove (Duplicates)

1. `tests/unit/backend/indicators/atr-indicator.test.ts` (duplicate of source version)
2. `tests/unit/backend/indicators/ema-indicator.test.ts` (duplicate of source version)
3. `tests/unit/backend/indicators/rsi-indicator.test.ts` (duplicate of source version)
4. `tests/unit/backend/indicators/sma-indicator.test.ts` (duplicate of source version)
5. `tests/unit/backend/JabbrLabs/signals/sma/sma-crossover-strategy.test.ts` (duplicate)
6. `tests/unit/backend/JabbrLabs/signals/sma/sma-signal-processor.test.ts` (duplicate)
7. `tests/integration/backend/strategies/strategy-factory.test.ts` (duplicate)

## Dependencies to Update

After migration, update these configurations:
- `packages/backend/jest.config.js` - Update test roots
- `packages/frontend/jest.config.js` - Create and configure
- `packages/shared/jest.config.js` - Create and configure
- Root `package.json` - Update test scripts
- CI/CD configurations - Update test paths

## Expected Outcome

- **Single source of truth** for each test
- **Clear separation** between actual tests and debug scripts
- **Consistent TypeScript** usage across all test files
- **Package-specific** test organization
- **Elimination** of the confusing root-level tests directory
