# JBR Frontend - Trading Dashboard & Monitoring Interface

The frontend package provides a modern web-based interface for monitoring and controlling the JBR Trading Bot Platform.

## 🏗️ Architecture Overview

```
Frontend Architecture:
┌─────────────────────────────────────┐
│        Presentation Layer           │ ← React Components & Pages
├─────────────────────────────────────┤
│         State Management            │ ← Context API & Local State
├─────────────────────────────────────┤
│        Service Layer                │ ← API Services & WebSocket
├─────────────────────────────────────┤
│         Backend APIs                │ ← REST & WebSocket Communication
└─────────────────────────────────────┘
```

## 📁 Directory Structure

```
src/
├── app/                        # Next.js App Router (13+)
│   ├── layout.tsx             # Root layout component
│   ├── page.tsx               # Main dashboard page
│   ├── bots/                  # Bot management pages
│   ├── strategies/            # Strategy configuration pages
│   ├── analytics/             # Trading analytics pages
│   └── globals.css            # Global styles
├── components/                 # Reusable UI components
│   ├── AlertSystem.tsx        # Alert notifications
│   ├── ConnectionStatus.tsx   # Connection indicators
│   ├── ErrorBoundary.tsx      # Error handling wrapper
│   ├── Loading.tsx            # Loading states
│   ├── LogAndAlertDashboard.tsx # Combined logging interface
│   ├── LogViewer.tsx          # Log viewing component
│   ├── PositionPnLVisualization.tsx # P&L charts
│   ├── StrategyMonitor.tsx    # Strategy monitoring
│   ├── TradingActivityMonitor.tsx # Trading activity
│   └── index.ts               # Component exports
├── contexts/                   # React Context providers
│   └── WebSocketContext.tsx   # WebSocket connection management
├── hooks/                      # Custom React hooks
│   └── useWebSocket.ts        # WebSocket hook
├── services/                   # API service layer
│   └── api.ts                 # Backend API communication
├── utils/                      # Utility functions
│   ├── connectionStatus.ts    # Connection utilities
│   ├── errorHandler.ts        # Error handling
│   └── theme.ts               # Theme configuration
└── config/                     # Configuration files
    └── api.config.ts          # API endpoints and settings
```

## 🔧 Core Technologies

### **Framework & Runtime**
- **Next.js 14** - React framework with App Router
- **React 18** - UI library with concurrent features
- **TypeScript** - Static typing for enhanced development

### **Styling & UI Components**
- **Tailwind CSS** - Utility-first CSS framework
- **Material-UI (MUI)** - React component library
- **CSS Modules** - Scoped styling where needed

### **State Management & Data Flow**
- **React Context API** - Application state management
- **WebSocket Client** - Real-time data communication
- **Fetch API** - HTTP requests to backend services

### **Development & Build Tools**
- **ESLint** - Code linting and quality
- **Prettier** - Code formatting
- **Jest** - Testing framework
- **PostCSS** - CSS processing

## 🚀 Getting Started

### **Development Setup**
```bash
# Navigate to frontend directory
cd packages/frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser
# http://localhost:3000
```

### **Environment Configuration**
Create `.env.local` for development:
```env
# Backend API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Application Settings
NEXT_PUBLIC_APP_NAME=JBR Trading Platform
NEXT_PUBLIC_VERSION=1.0.0
```

## 📱 Application Pages

### **Main Dashboard** (`/`)
- **Real-time Trading Overview** - Live P&L, positions, orders
- **Strategy Status** - Active strategies and performance
- **Market Data** - Price charts and indicators
- **System Health** - Connection status and alerts

### **Bot Management** (`/bots`)
- **Bot Control Panel** - Start/stop trading bots
- **Performance Metrics** - Historical performance data
- **Configuration** - Bot settings and parameters
- **Activity Logs** - Detailed bot activity history

### **Strategy Configuration** (`/strategies`)
- **Strategy List** - Available trading strategies
- **Parameter Configuration** - Strategy-specific settings
- **Backtesting Interface** - Historical strategy testing
- **Performance Analysis** - Strategy comparison tools

### **Analytics Dashboard** (`/analytics`)
- **Trading Performance** - Comprehensive P&L analysis
- **Risk Metrics** - Drawdown, Sharpe ratio, volatility
- **Signal Analysis** - Signal effectiveness and timing
- **Market Analysis** - Market condition analysis

## 🎨 Component Architecture

### **Core Components**

#### **Dashboard Components**
```typescript
// Main trading overview
<TradingActivityMonitor />
<PositionPnLVisualization />
<StrategyMonitor />
```

#### **System Components**
```typescript
// System status and communication
<ConnectionStatus />
<AlertSystem />
<LogViewer />
<ErrorBoundary />
```

#### **Layout Components**
```typescript
// Application structure
<Layout />
<Navigation />
<Sidebar />
<Header />
```

### **State Management Pattern**
```typescript
// Context-based state management
const { connectionStatus, isConnected } = useWebSocket();
const { alerts, addAlert, clearAlerts } = useAlerts();
const { tradingData, updateTradingData } = useTradingData();
```

## 🔌 API Integration

### **REST API Communication**
```typescript
// API service structure
class ApiService {
  // Strategy management
  async getStrategies(): Promise<Strategy[]>
  async createStrategy(strategy: CreateStrategyDto): Promise<Strategy>
  
  // Trading operations
  async getPositions(): Promise<Position[]>
  async placeOrder(order: OrderDto): Promise<Order>
  
  // Analytics
  async getPerformanceMetrics(): Promise<PerformanceMetrics>
}
```

### **WebSocket Integration**
```typescript
// Real-time data handling
useEffect(() => {
  const ws = new WebSocket(WS_URL);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleRealtimeUpdate(data);
  };
}, []);
```

## 🎯 Key Features

### **Real-time Monitoring**
- **Live P&L Tracking** - Real-time profit/loss updates
- **Position Monitoring** - Current holdings and exposure
- **Order Flow** - Live order book and trade execution
- **Market Data Streaming** - Price updates and indicators

### **Interactive Controls**
- **Bot Management** - Start/stop trading bots with confirmation
- **Strategy Configuration** - Adjust parameters in real-time
- **Emergency Controls** - Quick stop-all functionality
- **Manual Trading** - Direct order placement interface

### **Analytics & Visualization**
- **Performance Charts** - Interactive P&L and performance graphs
- **Technical Analysis** - Price charts with indicators
- **Risk Metrics** - Real-time risk assessment
- **Historical Analysis** - Backtesting results visualization

## 🧪 Testing Strategy

### **Test Structure**
```
tests/
├── components/              # Component unit tests
├── pages/                   # Page integration tests
├── services/                # API service tests
├── utils/                   # Utility function tests
└── e2e/                     # End-to-end tests
```

### **Testing Tools**
- **Jest** - Unit testing framework
- **React Testing Library** - Component testing utilities
- **MSW** (Mock Service Worker) - API mocking
- **Playwright** - E2E testing (planned)

### **Testing Commands**
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 🎨 Styling & Theming

### **Design System**
- **Color Palette** - Consistent brand colors across components
- **Typography** - Defined font scales and hierarchies
- **Spacing** - Standardized spacing units
- **Component Variants** - Consistent component styling

### **Responsive Design**
```css
/* Mobile-first responsive design */
/* Base styles for mobile */
.component { /* mobile styles */ }

/* Tablet and up */
@media (min-width: 768px) { /* tablet styles */ }

/* Desktop and up */  
@media (min-width: 1024px) { /* desktop styles */ }
```

### **Dark/Light Theme Support**
```typescript
// Theme configuration
const theme = {
  colors: {
    primary: { light: '#...', dark: '#...' },
    background: { light: '#...', dark: '#...' },
    text: { light: '#...', dark: '#...' }
  }
};
```

## 🔧 Development Workflow

### **Development Commands**
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint

# Code formatting
npm run format
```

### **Code Quality Standards**
- **TypeScript** - Strict type checking enabled
- **ESLint** - Extended React and TypeScript rules
- **Prettier** - Consistent code formatting
- **Husky** - Pre-commit hooks for quality control

## 📱 Progressive Web App (PWA)

### **PWA Features**
- **Offline Support** - Basic functionality without internet
- **Responsive Design** - Works on mobile and desktop
- **App-like Experience** - Install to home screen
- **Push Notifications** - Trading alerts and updates

## 🚀 Performance Optimization

### **Build Optimization**
- **Code Splitting** - Lazy loading of routes and components
- **Tree Shaking** - Dead code elimination
- **Bundle Analysis** - Monitor bundle size and dependencies
- **Image Optimization** - Next.js automatic image optimization

### **Runtime Performance**
- **Memoization** - React.memo and useMemo for expensive operations
- **Virtual Scrolling** - Efficient rendering of large data lists
- **Debouncing** - API calls and user input handling
- **WebSocket Connection Management** - Efficient real-time data handling

## 🔐 Security Considerations

### **Frontend Security**
- **CSP Headers** - Content Security Policy implementation
- **XSS Prevention** - Input sanitization and validation
- **Secure API Communication** - HTTPS and proper authentication
- **Environment Variables** - Proper handling of sensitive data

## 🚀 Deployment

### **Production Build**
```bash
# Build optimized production bundle
npm run build

# Serve static files
npm start
```

### **Deployment Platforms**
- **Vercel** - Recommended for Next.js applications
- **Netlify** - Alternative static hosting
- **Docker** - Containerized deployment option

## 🔗 Dependencies & Integration

### **Major Dependencies**
```json
{
  "next": "14.x",
  "react": "18.x", 
  "@mui/material": "^5.x",
  "tailwindcss": "^3.x",
  "typescript": "^5.x"
}
```

### **Backend Integration**
- **REST API** - HTTP requests for data operations
- **WebSocket** - Real-time updates and notifications
- **Shared Types** - TypeScript interfaces from @jbr/shared

---

**Package Version**: v1.0.0
**Node.js Requirement**: >=18.0.0
**Browser Support**: Modern browsers (Chrome, Firefox, Safari, Edge)
**Documentation Status**: ✅ Complete and stable
**Last Updated**: July 2025
