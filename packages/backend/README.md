# JBR Backend - Trading Engine & API Server

The backend package contains the core trading engine, API server, and business logic for the JBR Trading Bot Platform.

## 🏗️ Architecture Overview

```
Backend Layer Architecture:
┌─────────────────────────────────────┐
│           API Layer                 │ ← Express Routes & Controllers
├─────────────────────────────────────┤
│         Service Layer               │ ← Business Logic & Orchestration
├─────────────────────────────────────┤
│       Data Access Layer             │ ← Database & External APIs
└─────────────────────────────────────┘
```

## 📁 Directory Structure

```
src/
├── JabbrLabs/                   # Core trading algorithms
│   ├── bot-cycle/              # Trading cycle management
│   ├── bot-trading-cycle-integration/ # Integration logic
│   ├── indicators/             # Technical analysis indicators
│   └── signals/                # Signal processing (SMA, etc.)
├── bots/                       # Bot management system
├── config/                     # Configuration management
├── database/                   # Database connection & migrations
├── routes/                     # API endpoint definitions
├── scripts/                    # Utility scripts & backtesting
├── services/                   # Business logic services
└── websocket/                  # Real-time communication
```

## 🔧 Core Technologies

### **Runtime & Framework**
- **Node.js** (v18+) - JavaScript runtime
- **Express.js** - Web application framework
- **TypeScript** - Static typing and enhanced developer experience

### **Database & Persistence**
- **PostgreSQL** - Primary database for trading data
- **Redis** - Caching and session management
- **TypeORM** - Database ORM and migration management

### **External Integrations**
- **Bybit API** - Cryptocurrency exchange integration
- **WebSocket** - Real-time market data and order updates
- **Technical Analysis Libraries** - Price indicators and signals

## 🚀 Getting Started

### **Development Setup**
```bash
# Navigate to backend directory
cd packages/backend

# Install dependencies
npm install

# Set up environment variables
cp ../../.env.example ../../.env
# Edit .env with your API keys and database credentials

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

### **Environment Configuration**
Required environment variables in `.env`:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/jabbr_dev
REDIS_URL=redis://localhost:6379

# Trading APIs
BYBIT_API_KEY=your_api_key
BYBIT_API_SECRET=your_api_secret
BYBIT_TESTNET=true

# Application
NODE_ENV=development
PORT=3001
```

## 📡 API Endpoints

### **Core API Routes**
```
GET    /api/health              # Health check
GET    /api/strategies          # List trading strategies
POST   /api/strategies          # Create new strategy
GET    /api/positions           # Current trading positions
GET    /api/orders              # Order history
POST   /api/orders              # Place new order
GET    /api/market-data         # Market data and prices
WS     /api/websocket           # Real-time updates
```

### **Bot Management**
```
GET    /api/bots                # List active bots
POST   /api/bots/start          # Start trading bot
POST   /api/bots/stop           # Stop trading bot
GET    /api/bots/:id/status     # Bot status and metrics
```

### **Analytics & Reporting**
```
GET    /api/analytics/performance    # Trading performance metrics
GET    /api/analytics/signals        # Signal analysis data
GET    /api/backtest                 # Backtesting results
```

## 🧠 Trading Engine Components

### **Signal Processing** (`src/JabbrLabs/signals/`)
- **SMA Signal Processor** - Simple Moving Average strategy
- **Signal Management** - Signal generation and validation
- **Strategy Framework** - Pluggable strategy system

### **Indicators** (`src/JabbrLabs/indicators/`)
- **SMA** (Simple Moving Average)
- **EMA** (Exponential Moving Average) 
- **RSI** (Relative Strength Index)
- **ATR** (Average True Range)

### **Bot Management** (`src/bots/`)
- **Bot Manager** - Lifecycle management of trading bots
- **Dynamic Strategy Loader** - Runtime strategy loading
- **Execution Engine** - Order placement and management

## 🔄 Development Workflow

### **Running the Server**
```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run build
npm start

# Standalone trading engine (no web server)
npm run start:standalone
```

### **Database Management**
```bash
# Create new migration
npm run migration:create -- MigrationName

# Run pending migrations
npm run migrate

# Revert last migration
npm run migration:revert
```

### **Testing & Quality**
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=signals

# Lint code
npm run lint

# Format code
npm run format
```

## 📊 Key Services

### **Strategy Service** (`src/services/strategy.service.ts`)
- Strategy registration and management
- Performance tracking and analytics
- Risk management integration

### **Market Data Service** (`src/services/market-data.service.ts`)
- Real-time price data collection
- Historical data management  
- WebSocket connection management

### **Order Management Service** (`src/services/order-management.service.ts`)
- Order placement and tracking
- Portfolio management
- Risk assessment and position sizing

## 🧪 Testing Strategy

### **Test Structure**
```
tests/
├── unit/                    # Unit tests for individual components
├── integration/             # Integration tests for services
├── e2e/                    # End-to-end API tests
└── fixtures/               # Test data and mocks
```

### **Testing Tools**
- **Jest** - Testing framework
- **Supertest** - API endpoint testing
- **Test Containers** - Database testing with Docker

### **Coverage Targets**
- **Unit Tests**: 85%+ coverage
- **Integration Tests**: Critical business logic paths
- **E2E Tests**: Main API workflows

## 🔐 Security & Configuration

### **Security Measures**
- API key encryption and secure storage
- Rate limiting on public endpoints
- Input validation and sanitization
- SQL injection prevention via TypeORM

### **Configuration Management**
- Environment-based configuration
- Secure credential management
- Configuration validation on startup
- Hot-reloading of non-sensitive configs

## 📈 Performance & Monitoring

### **Metrics Collection**
- Trading performance metrics
- API response times
- Database query performance
- Memory and CPU usage

### **Logging**
- Structured JSON logging
- Trading activity logs
- Error tracking and alerting
- Performance monitoring

## 🚀 Deployment

### **Production Setup**
```bash
# Build for production
npm run build

# Start production server
NODE_ENV=production npm start
```

### **Docker Deployment**
```dockerfile
# Dockerfile included in package
docker build -t jbr-backend .
docker run -p 3001:3001 jbr-backend
```

## 🔧 Scripts & Utilities

### **Backtesting Scripts** (`src/scripts/backtest/`)
```bash
npm run backtest              # Run SMA strategy backtest
npm run backtest:fixed        # Run fixed SMA strategy backtest
npm run debug:signals         # Debug signal generation
```

### **Database Scripts**
```bash
npm run test:db               # Test database connection
npm run debug:db              # Database debugging utilities
```

## 🔗 Dependencies & Integration

### **External Dependencies**
- **Technical Analysis**: Custom indicator implementations
- **Exchange APIs**: Bybit integration for live trading
- **Database**: PostgreSQL with TypeORM
- **Caching**: Redis for performance optimization

### **Internal Dependencies**
- **@jbr/shared** - Common types and utilities
- **Frontend Communication** - REST API and WebSocket

## 📋 Environment Layers

| Environment | Database    | Trading Mode | Logging Level | Debug Mode |
|-------------|-------------|--------------|---------------|------------|
| Development | PostgreSQL  | Testnet      | Debug         | Enabled    |
| Staging     | PostgreSQL  | Testnet      | Info          | Limited    |
| Production  | PostgreSQL  | Mainnet      | Warn          | Disabled   |

---

**Package Version**: v1.0.0
**Node.js Requirement**: >=18.0.0
**Documentation Status**: ✅ Complete and stable
**Last Updated**: July 2025
