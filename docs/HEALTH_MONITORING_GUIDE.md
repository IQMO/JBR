# Health Monitoring Guide

## Overview

The Jabbr Trading Platform includes a comprehensive health monitoring system that provides detailed insights into system components and their operational status. This system is designed for production environments and supports Kubernetes deployment patterns.

## Health Check Endpoints

### Base Health Check
```
GET /health
```
Returns overall system health status with summary information.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 3600,
    "componentsHealthy": 7,
    "componentsTotal": 8,
    "summary": {
      "healthy": ["database", "memory", "cpu", "bots", "exchanges"],
      "unhealthy": ["websockets"],
      "degraded": ["logging"]
    }
  },
  "meta": {
    "responseTime": 45,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "endpoint": "/health"
  }
}
```

### Quick Health Check
```
GET /health/quick
```
Fast health check with minimal overhead, suitable for high-frequency monitoring.

### Detailed Health Check
```
GET /health/detailed
```
Comprehensive health information including metrics, performance data, and component details.

**Response includes:**
- Individual component health status
- Performance metrics (CPU, memory, response times)
- Active bot statuses
- Exchange connection health
- Database connection pool status
- WebSocket connection counts
- Recent error rates

### Component-Specific Health
```
GET /health/components/:component
```
Get detailed health information for a specific component.

**Available components:**
- `database` - Database connection and query performance
- `memory` - Memory usage and garbage collection metrics
- `cpu` - CPU utilization and load averages
- `bots` - Active trading bot statuses
- `exchanges` - Exchange API connections and latency
- `websockets` - WebSocket server and client connections
- `logging` - Log system health and error rates

### Kubernetes Probes

#### Readiness Probe
```
GET /health/readiness
```
Indicates if the application is ready to receive traffic. Returns 200 when all critical components are healthy.

**Use in Kubernetes:**
```yaml
readinessProbe:
  httpGet:
    path: /health/readiness
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

#### Liveness Probe
```
GET /health/liveness
```
Indicates if the application is alive and should not be restarted. Returns 200 unless the application is completely unresponsive.

**Use in Kubernetes:**
```yaml
livenessProbe:
  httpGet:
    path: /health/liveness
    port: 3001
  initialDelaySeconds: 60
  periodSeconds: 30
  timeoutSeconds: 10
  failureThreshold: 3
```

### System Metrics
```
GET /health/metrics
```
Returns detailed system metrics in a structured format suitable for monitoring systems.

### Status Overview
```
GET /health/status
```
Simple status endpoint that returns HTTP 200 for healthy, 503 for unhealthy.

## Health Monitoring Components

### SystemHealthService

The `SystemHealthService` is responsible for:

1. **Component Health Checks**
   - Database connectivity and performance
   - Memory usage monitoring
   - CPU utilization tracking
   - Active bot status verification
   - Exchange API health checks
   - WebSocket connection monitoring
   - Logging system health

2. **Performance Metrics**
   - Request/response time tracking
   - Error rate calculation
   - Throughput monitoring
   - Resource utilization metrics

3. **Health Status Determination**
   - Component-level health assessment
   - Overall system health calculation
   - Degraded state detection
   - Critical failure identification

### Health Status Levels

- **Healthy**: Component is operating normally
- **Degraded**: Component is operational but with reduced performance
- **Unhealthy**: Component has critical issues affecting functionality

### Thresholds and Limits

#### Memory
- **Healthy**: < 80% usage
- **Degraded**: 80-90% usage
- **Unhealthy**: > 90% usage

#### CPU
- **Healthy**: < 70% usage
- **Degraded**: 70-85% usage
- **Unhealthy**: > 85% usage

#### Database
- **Healthy**: Query time < 100ms, connection pool healthy
- **Degraded**: Query time 100-500ms, some connection issues
- **Unhealthy**: Query time > 500ms, connection failures

#### Trading Bots
- **Healthy**: All bots responding, no critical errors
- **Degraded**: Some bots have warnings, minor issues
- **Unhealthy**: Bot failures, critical trading errors

## Monitoring Integration

### Prometheus Metrics
The health system can be extended to export metrics in Prometheus format for integration with monitoring stacks.

### Alerting
Configure alerts based on:
- Overall system health status
- Individual component health degradation
- Performance threshold breaches
- Error rate increases

### Logging
All health check activities are logged with appropriate levels:
- **INFO**: Regular health checks
- **WARN**: Degraded component performance
- **ERROR**: Component failures
- **CRITICAL**: System-wide health issues

## Production Deployment

### Environment Variables
```bash
# Health check configuration
HEALTH_CHECK_INTERVAL=30000        # 30 seconds
HEALTH_CHECK_TIMEOUT=5000          # 5 seconds
HEALTH_CHECK_RETRIES=3             # Retry count
HEALTH_CHECK_DB_QUERY_TIMEOUT=1000 # 1 second
```

### Monitoring Setup
1. Configure Kubernetes probes
2. Set up external monitoring (e.g., Prometheus + Grafana)
3. Configure alerting rules
4. Set up log aggregation
5. Monitor health endpoint response times

### Best Practices
1. Use quick health checks for high-frequency monitoring
2. Use detailed checks for diagnostics and troubleshooting
3. Monitor trends, not just current status
4. Set appropriate timeout values for your environment
5. Configure alerts for both immediate issues and trending problems

## Troubleshooting

### Common Issues

1. **High Response Times**
   - Check database query performance
   - Verify CPU/Memory usage
   - Review active bot counts

2. **Component Failures**
   - Check individual component endpoints
   - Review application logs
   - Verify external service connectivity

3. **Intermittent Failures**
   - Monitor over time periods
   - Check for resource constraints
   - Review error patterns

### Debug Information
Access detailed debug information through:
- `/health/detailed` - Comprehensive system state
- `/health/components/:component` - Component-specific details
- Application logs with health check correlation IDs

## API Reference

All health endpoints return standardized responses with:
- `success`: Boolean indicating request success
- `data`: Health information payload
- `meta`: Response metadata (timing, timestamps)
- `error`: Error details (when applicable)

Status codes:
- `200`: Healthy/Success
- `503`: Unhealthy/Service Unavailable
- `404`: Component not found
- `500`: Internal server error

For detailed API schemas and examples, see the individual endpoint documentation above.
