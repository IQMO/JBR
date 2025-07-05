# JBR Packages - Monorepo Architecture

This directory contains the core packages of the JBR (Jabbr Trading Bot Platform) in a modular monorepo structure.

## 📁 Package Structure

```
packages/
├── backend/          # Trading engine and API services
├── frontend/         # Next.js web application
└── shared/           # Common utilities and types
```

## 🏗️ Architecture Overview

### **Layer Dependencies** (Top to Bottom)
```
📱 Frontend (React/Next.js)
    ↓ API calls
🔧 Backend (Node.js/Express)
    ↓ Database & Trading APIs
📊 External Services (Database, Exchanges)
```

### **Shared Dependencies**
```
🔄 Shared Package
├── Types & Interfaces
├── Validation Schemas  
├── Common Utilities
└── Constants
```

## 📦 Package Details

### **Backend Package** (`./backend/`)
- **Purpose**: Core trading engine, API server, and business logic
- **Technology**: Node.js, Express, TypeScript
- **Dependencies**: PostgreSQL, Redis, WebSocket connections
- **Layer**: Service Layer + Data Access Layer
- **Entry Points**: 
  - `src/server.ts` - Main API server
  - `src/server-standalone.ts` - Standalone trading engine
  - `src/index.ts` - Combined server

### **Frontend Package** (`./frontend/`)
- **Purpose**: Web-based trading dashboard and monitoring interface
- **Technology**: Next.js, React, TypeScript, Tailwind CSS
- **Dependencies**: Material-UI, WebSocket client, Chart libraries
- **Layer**: Presentation Layer
- **Entry Points**:
  - `src/app/page.tsx` - Main dashboard
  - `src/app/layout.tsx` - Application layout

### **Shared Package** (`./shared/`)
- **Purpose**: Common types, utilities, and validation logic
- **Technology**: TypeScript, Zod validation
- **Dependencies**: Minimal (utility-focused)
- **Layer**: Cross-cutting concerns
- **Entry Points**:
  - `src/index.ts` - Main exports

## 🔧 Development Workflow

### **Package Management**
```bash
# Install all package dependencies
npm run install:all

# Build all packages
npm run build

# Run all tests
npm run test
```

## Inter-package Dependencies

### **Dependency Flow**
- Frontend → Shared (types, utilities)
- Backend → Shared (types, validation)
- Packages are developed independently but share common interfaces

### **Build Order**
1. **Shared** (foundational types)
2. **Backend** (API and services)
3. **Frontend** (UI consuming APIs)

## 🚀 Development Commands

### **Cross-package Commands** (from root)
```bash
npm run dev:backend      # Start backend development server
npm run dev:frontend     # Start frontend development server
npm run dev:all          # Start all services concurrently
```

### **Package-specific Commands**
```bash
cd packages/backend && npm run dev
cd packages/frontend && npm run dev
cd packages/shared && npm run build
```

## 📋 Configuration

### **TypeScript Configuration**
- Root `tsconfig.json` provides base configuration
- Each package extends root config with package-specific settings
- Shared types are automatically available across packages

### **ESLint & Prettier**
- Consistent code formatting across all packages
- Package-specific ESLint configurations in each directory
- Root-level Prettier configuration applies to all packages

## 🔄 Package Integration

### **Shared Type System**
```typescript
// Shared types available in all packages
import { TradingSignal, Strategy, MarketData } from '@jbr/shared';
```

### **API Communication**
```typescript
// Frontend → Backend
const response = await fetch('/api/strategies');

// Backend → Database
const strategy = await strategyRepository.findById(id);
```

## 📊 Dependency Graph

```
Frontend Package Dependencies:
├── @jbr/shared
├── next
├── react
├── @mui/material
└── tailwindcss

Backend Package Dependencies:
├── @jbr/shared
├── express
├── typeorm
├── pg (PostgreSQL)
└── ws (WebSocket)

Shared Package Dependencies:
├── zod (validation)
└── typescript
```

## 🧪 Testing Strategy

### **Unit Tests**
- Each package contains its own test suite
- Shared utilities are tested in the shared package
- Mock external dependencies for isolated testing

### **Integration Tests**
- Cross-package integration tests in root `tests/` directory
- API endpoint testing in backend package
- Component testing in frontend package

## 📈 Package Metrics

| Package  | LOC     | Dependencies | Test Coverage | Build Size |
|----------|---------|--------------|---------------|------------|
| Backend  | ~15,000 | 25+ npm      | Target: 80%   | ~5MB       |
| Frontend | ~8,000  | 30+ npm      | Target: 70%   | ~2MB       |
| Shared   | ~2,000  | 5 npm        | Target: 90%   | ~500KB     |

## 🛡️ Security Considerations

- **Backend**: Input validation, authentication, rate limiting
- **Frontend**: CSP headers, XSS prevention, secure API calls
- **Shared**: Validation schemas prevent malformed data

## 🔮 Future Considerations

### **Scalability**
- Packages designed for independent deployment
- Microservice migration path available
- Database sharding considerations in backend

### **New Package Addition**
- Follow established patterns for TypeScript configuration
- Ensure proper dependency management
- Add appropriate testing infrastructure
- Update this documentation

---

**Documentation Status**: ✅ Complete and stable
**Last Updated**: July 2025
**Maintenance**: This file describes architectural decisions and should rarely change
