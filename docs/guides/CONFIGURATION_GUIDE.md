# 🔧 Jabbr Trading Bot Platform - Configuration Guide

## 📋 Table of Contents
- [🎯 Quick Start Configuration](#-quick-start-configuration)
- [📋 Prerequisites](#-prerequisites)
- [⚡ Quick Setup (5 Minutes)](#-quick-setup-5-minutes)
- [🔐 API Key Configuration](#-api-key-configuration)
- [📁 Project Structure](#-project-structure)
- [⚙️ Configuration Files](#️-configuration-files)
- [📊 Strategy Framework](#-strategy-framework)
- [🚀 Deployment Modes](#-deployment-modes)
- [🔧 Configuration Options](#-configuration-options)
- [🛠️ Development Configuration](#️-development-configuration)
- [🔍 Monitoring & Debugging](#-monitoring--debugging)
- [🚨 Troubleshooting](#-troubleshooting)
- [🔐 Security Configuration](#-security-configuration)
- [📈 Performance Monitoring](#-performance-monitoring)
- [🧪 Test Configuration](#-test-configuration)
- [🎯 Next Steps](#-next-steps)

## 🎯 Quick Start Configuration

This guide provides **minimum impact** configuration steps to get the Jabbr Trading Bot Platform operational.

## 📋 Prerequisites

### **System Requirements**
- **Node.js**: v18+ (recommended: v20+)
- **npm/pnpm**: Latest version
- **Git**: For version control
- **VS Code/Cursor**: Recommended IDE with TypeScript support

### **Optional Requirements**
- **PostgreSQL**: For full database functionality (can run without for testing)
- **Redis**: For caching (optional, system works without)

## ⚡ Quick Setup (5 Minutes)

### **1. Clone and Install**
```bash
git clone <repository-url>
cd jabbr-trading-bot-platform
npm install
```

### **2. Environment Configuration**
The project uses a unified root-level `.env` file:
```bash
# Copy the example configuration if needed
cp .env.example .env

# The working .env file is already configured and ready to use
# All packages automatically load from the root .env file
```

### **3. Start Development Servers**
```bash
# Option A: Full development (frontend + backend)
npm run dev

# Option B: Backend only (standalone mode)
cd packages/backend
npx ts-node src/server-standalone.ts
```

### **4. Verify Installation**
- **Health Check**: http://localhost:3001/health
- **Trading Test**: http://localhost:3001/api/test-trading
- **Market Data**: http://localhost:3001/api/market/BTCUSDT

## 🔐 API Key Configuration

### **Bybit API Keys**
The system supports both testnet and mainnet configurations:

```bash
# Testnet (Safe for development)
BYBIT_API_KEY=DsBkIFhCCmPmfz8THD
BYBIT_API_SECRET=swDPO6E2JVswGfVOQ1oyjcj5L8rWNJdO5EL9
BYBIT_TESTNET=true

# Mainnet (Live trading)
BYBIT_MAINNET_API_KEY=3TZG3zGNOZBa5Fnuck
BYBIT_MAINNET_API_SECRET=k2loWLXJhswTajZvGhwdW98soSGL87BjDIWI
```

### **API Key Security**
- Keys are encrypted using AES-256-CBC
- Testnet keys are safe for development
- Mainnet keys should be secured in production

## 📁 Project Structure

```
jabbr-trading-bot-platform/
├── packages/
│   ├── backend/           # Trading engine & API server
│   │   ├── src/
│   │   │   ├── exchanges/ # Exchange integrations (Bybit)
│   │   │   ├── services/  # Core services (auth, time sync)
│   │   │   ├── database/  # Database layer & migrations
│   │   │   └── websocket/ # Real-time communication
│   │   ├── .env          # Environment configuration
│   │   └── server-standalone.ts # Database-free server
│   ├── frontend/         # React/Next.js dashboard
│   └── shared/           # Shared types & validation
├── .taskmaster/          # Task management
│   ├── tasks/           # Task definitions
│   ├── config.json      # AI model configuration
│   └── docs/            # Project documentation
├── PROJECT_STATUS.md     # Current project status
└── CONFIGURATION_GUIDE.md # This file
```

## ⚙️ Configuration Files

### **Environment Variables (.env)**
Located in the project root (`.env`):

```bash
# JWT Configuration
JWT_SECRET=jabbr_super_secret_key_2024_trading_bot_platform_development
JWT_REFRESH_SECRET=jabbr_refresh_secret_key_2024_trading_bot_platform_development
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Database Configuration (Optional)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=jabbr_trading_bot
DATABASE_USER=postgres
DATABASE_PASSWORD=password
DATABASE_SSL=false

# Encryption Configuration
ENCRYPTION_KEY=jabbr_encryption_key_32_chars_long_2024

# Server Configuration
PORT=3001
WS_PORT=3002
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Time Synchronization
NTP_SERVER=pool.ntp.org
TIME_SYNC_INTERVAL=300000
MAX_TIME_DRIFT=30000
NTP_TIMEOUT=10000
ENABLE_TIME_SYNC=true
```

### **Taskmaster Configuration (.taskmaster/config.json)**
AI model configuration for task management:

```json
{
  "models": {
    "main": {
      "provider": "google",
      "modelId": "gemini-2.0-flash",
      "maxTokens": 1048000,
      "temperature": 0.2
    },
    "research": {
      "provider": "google", 
      "modelId": "gemini-2.0-flash",
      "maxTokens": 1048000,
      "temperature": 0.1
    },
    "fallback": {
      "provider": "google",
      "modelId": "gemini-2.0-flash", 
      "maxTokens": 1048000,
      "temperature": 0.1
    }
  },
  "global": {
    "logLevel": "info",
    "defaultTag": "master",
    "projectName": "Jabbr Trading Bot Platform"
  }
}
```

## � Strategy Framework

### **Overview**
The Strategy Framework allows for development, configuration, and deployment of custom trading strategies using a plugin architecture. Strategies can be defined in TypeScript or JavaScript and are loaded dynamically at runtime.

### **Creating Custom Strategies**
Custom strategies must implement the `Strategy` interface:

```typescript
// Example: plugins/example-sma-strategy.ts
import { Strategy, MarketData, TradeSignal, StrategyParams } from '@jabbr/shared';

export default class SMAStrategy implements Strategy {
  private fastPeriod: number;
  private slowPeriod: number;
  
  constructor(params: StrategyParams) {
    this.fastPeriod = params.fastPeriod || 10;
    this.slowPeriod = params.slowPeriod || 20;
  }
  
  async analyze(data: MarketData[]): Promise<TradeSignal> {
    // Strategy implementation
    return {
      action: 'BUY',
      symbol: 'BTC/USDT',
      confidence: 0.8,
      timestamp: Date.now()
    };
  }
}
```

### **Backtesting Strategies**
Strategies can be backtested using the built-in backtesting framework:

```typescript
// Example backtesting setup
import { StrategyBacktester } from './strategies/strategy-backtest';
import SMAStrategy from './plugins/example-sma-strategy';

const backtest = new StrategyBacktester({
  strategy: new SMAStrategy({ fastPeriod: 20, slowPeriod: 50 }),
  initialCapital: 10000,
  startDate: '2023-01-01',
  endDate: '2023-12-31',
  symbol: 'BTC/USDT'
});

backtest.run().then(results => {
  console.log('Backtest Results:', results);
});
```

## �🚀 Deployment Modes

### **Mode 1: Standalone (Recommended for Testing)**
- **No Database Required**: Runs without PostgreSQL
- **Quick Start**: Fastest way to test the trading engine
- **Full Trading**: Complete trading functionality available

```bash
cd packages/backend
npx ts-node src/server-standalone.ts
```

### **Mode 2: Full Stack (Production)**
- **Complete Infrastructure**: All services running
- **Database Integration**: Full PostgreSQL functionality
- **WebSocket Services**: Real-time communication

```bash
npm run dev
```

### **Mode 3: Production Deployment**
- **Environment Variables**: Production-ready configuration
- **Security Hardening**: All security measures enabled
- **Monitoring**: Health checks and logging active

```bash
npm run build
npm run start
```

## 🔧 Configuration Options

### **Trading Engine Settings**

#### **Exchange Configuration**
```typescript
// Bybit Configuration
const exchangeConfig = {
  spot: true,           // Spot trading enabled
  futures: true,        // Futures trading enabled
  maxLeverage: {
    spot: 10,          // 10x max for spot
    futures: 100       // 100x max for futures
  },
  supportedOrderTypes: ['market', 'limit', 'stop', 'stop-limit'],
  rateLimits: {
    requests: 120,     // 120 requests per minute
    window: 60000      // 1 minute window
  }
}
```

#### **Risk Management Settings**
```typescript
const riskConfig = {
  maxPositionSize: 0.1,      // 10% of account
  maxLeverage: 10,           // Maximum 10x leverage
  stopLossPercentage: 0.02,  // 2% stop loss
  takeProfitPercentage: 0.05 // 5% take profit
}
```

### **Strategy Framework Configuration**

#### **Plugin Configuration**
```typescript
// Strategy plugin directory configuration
const pluginConfig = {
  directory: './plugins',           // Plugin directory location
  allowedExtensions: ['.ts', '.js'], // Allowed file extensions
  whitelistedDependencies: [        // Allowed dependencies
    '@jabbr/shared',
    'technicalindicators',
    'zod'
  ],
  securitySandbox: true,            // Enable security sandbox
  dynamicReloading: true            // Enable hot-reloading
}
```

#### **Strategy Configuration**
```typescript
// Example strategy configuration
const strategyConfig = {
  type: 'sma-crossover',
  parameters: {
    symbol: 'BTC/USDT',
    fastPeriod: 20,
    slowPeriod: 50,
    signalThreshold: 0
  },
  riskManagement: {
    stopLossPercentage: 0.05,      // 5% stop loss
    takeProfitPercentage: 0.15     // 15% take profit
  },
  execution: {
    timeframe: '1h',
    minimumConfidence: 0.6
  }
}
```

#### **Backtesting Configuration**
```typescript
// Backtesting configuration
const backtestConfig = {
  initialCapital: 10000,     // Starting capital
  fees: 0.001,               // 0.1% fees
  slippage: 0.001,           // 0.1% slippage
  startDate: '2023-01-01',   // Backtest start date
  endDate: '2023-12-31',     // Backtest end date
  enableLogs: true,          // Enable detailed logging
  saveTradeDetails: true     // Save individual trade details
}
```

### **WebSocket Configuration**
```typescript
const wsConfig = {
  port: 3002,                // WebSocket server port
  maxConnections: 100,       // Maximum concurrent connections
  heartbeatInterval: 30000,  // 30 second heartbeat
  reconnectDelay: 5000       // 5 second reconnect delay
}
```

### **Time Synchronization Settings**
```typescript
const timeSyncConfig = {
  ntpServer: 'pool.ntp.org',    // NTP server
  syncInterval: 300000,         // 5 minute sync interval
  maxDrift: 30000,             // 30 second max drift
  timeout: 10000               // 10 second timeout
}
```

## 🛠️ Development Configuration

### **TypeScript Configuration**
Each package has optimized TypeScript settings:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "outDir": "./dist"
  }
}
```

### **Build Configuration**
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/index.ts",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src/**/*.ts"
  }
}
```

## 🔍 Monitoring & Debugging

### **Health Check Endpoints**
- **System Health**: `GET /health`
- **Trading Status**: `GET /api/test-trading`
- **Market Data**: `GET /api/market/:symbol`

### **Logging Configuration**
```typescript
const loggingConfig = {
  level: 'info',              // Log level
  format: 'json',             // Log format
  transports: [
    'console',                // Console output
    'file'                    // File output
  ],
  rotation: {
    maxSize: '10m',           // 10MB max file size
    maxFiles: '5'             // Keep 5 files
  }
}
```

### **Debug Mode**
```bash
# Enable debug logging
NODE_ENV=development DEBUG=* npm run dev

# TypeScript compilation check
npx tsc --noEmit

# Dependency audit
npm audit
```

## 🚨 Troubleshooting

### **Common Issues**

#### **Port Conflicts**
```bash
# Check port usage
netstat -an | findstr :3001
netstat -an | findstr :3002

# Kill processes using ports
taskkill /PID <process_id> /F
```

#### **Environment Variables Not Loading**
```bash
# Verify .env file exists in project root
ls .env

# Environment loading is automatic via:
# - Jest setup: require('dotenv').config({ path: '../../.env' })
# - Package scripts: dotenv -e ../../.env
```

#### **TypeScript Compilation Errors**
```bash
# Clean build
rm -rf dist/
npm run build

# Check for type errors
npx tsc --noEmit
```

#### **API Connection Issues**
```bash
# Test API connectivity
curl http://localhost:3001/health

# Check WebSocket connection
wscat -c ws://localhost:3002
```

### **Performance Optimization**

#### **Database Optimization**
```sql
-- Index optimization
CREATE INDEX idx_trades_timestamp ON trades(timestamp);
CREATE INDEX idx_positions_symbol ON positions(symbol);
```

#### **Memory Optimization**
```typescript
// Node.js memory settings
node --max-old-space-size=4096 src/index.ts
```

#### **Rate Limiting Optimization**
```typescript
const rateLimitConfig = {
  windowMs: 60000,     // 1 minute window
  max: 120,            // 120 requests per window
  standardHeaders: true,
  legacyHeaders: false
}
```

## 🔐 Security Configuration

### **Production Security Checklist**
- [ ] **Environment Variables**: Secure storage of sensitive data
- [ ] **API Key Encryption**: AES-256-CBC encryption enabled
- [ ] **JWT Security**: Strong secrets and proper expiration
- [ ] **Rate Limiting**: Protection against abuse
- [ ] **Input Validation**: Zod schema validation active
- [ ] **HTTPS**: SSL/TLS encryption for production
- [ ] **CORS**: Proper cross-origin configuration
- [ ] **Helmet**: Security headers configured

### **API Key Management**
```typescript
// Secure API key storage
const encryptedKey = encrypt(apiKey, ENCRYPTION_KEY);

// Rate limiting per API key
const keyRateLimit = rateLimit({
  keyGenerator: (req) => req.user.apiKeyId,
  windowMs: 60000,
  max: 60
});
```

## 📈 Performance Monitoring

### **Key Metrics to Monitor**
- **API Response Time**: <200ms target
- **WebSocket Latency**: <50ms target
- **Order Execution Time**: <1s target
- **Memory Usage**: <1GB target
- **CPU Usage**: <50% average

### **Monitoring Tools**
```typescript
// Performance monitoring
const performanceConfig = {
  enableMetrics: true,
  metricsInterval: 60000,    // 1 minute intervals
  alertThresholds: {
    responseTime: 500,       // 500ms alert threshold
    errorRate: 0.05,         // 5% error rate alert
    memoryUsage: 0.8         // 80% memory alert
  }
}
```

---

## 🎯 Next Steps

1. **Complete Current Setup**: Follow the quick start guide
2. **Test Trading Functions**: Use the health check endpoints
3. **Configure API Keys**: Set up your exchange credentials
4. **Monitor Performance**: Watch the key metrics
5. **Scale as Needed**: Add additional services when required

---

*This configuration guide ensures minimal impact setup while maintaining full functionality and production readiness.*

## 🧪 Test Configuration

### **Test File Organization**
All tests must be organized according to the following structure:
```
packages/
├── backend/
│   ├── tests/           # All test files must be in this directory
│   │   ├── unit/        # Unit tests for individual components
│   │   ├── integration/ # Integration tests between components
│   │   ├── e2e/         # End-to-end tests for full workflows
│   │   └── fixtures/    # Test data and mock objects
├── frontend/
│   ├── tests/           # All frontend test files
│   │   ├── unit/        # Component tests
│   │   └── e2e/         # End-to-end frontend tests
```

### **Test File Organization**
All tests must be organized according to the following structure:
```
packages/
├── backend/
│   ├── tests/           # All test files must be in this directory
│   │   ├── unit/        # Unit tests for individual components
│   │   ├── integration/ # Integration tests between components
│   │   ├── e2e/         # End-to-end tests for full workflows
│   │   ├── fixtures/    # Test data and mock objects
│   │   ├── results/     # Test results and reports (gitignored)
│   │   └── helpers/     # Test helper utilities
├── frontend/
│   ├── tests/           # All frontend test files
│   │   ├── unit/        # Component tests
│   │   ├── e2e/         # End-to-end frontend tests
│   │   ├── fixtures/    # Test data and mock API responses
│   │   ├── results/     # Test results (gitignored)
│   │   └── helpers/     # Test helper utilities
└── shared/
    └── tests/           # Shared package tests
        ├── unit/        # Unit tests for shared code
        ├── fixtures/    # Test data
        └── results/     # Test results (gitignored)
```

**IMPORTANT:** Test files must never be placed at the root level of any package. All test-related artifacts, including results and reports, should be stored within the appropriate tests directory.

### **Test Configuration Files**
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/tests/**/*.test.+(ts|tsx|js)',
    '**/tests/**/*.spec.+(ts|tsx|js)'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverageFrom: ['src/**/*.{js,ts}'],
  coverageDirectory: './tests/results/coverage',
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  testResultsProcessor: './tests/results-processor.js'
};
```