/**
 * Health Check API Routes
 * 
 * Provides REST API endpoints for system health monitoring
 * including overall health, component-specific health,
 * and readiness/liveness probes for Kubernetes.
 */

import type { Request, Response } from 'express';
import { Router } from 'express';

import logger from '../services/logging.service';
import SystemHealthService from '../services/system-health.service';

const router = Router();
const healthService = new SystemHealthService();

/**
 * @route GET /health
 * @desc Get overall system health status
 * @access Public
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const useCache = req.query.cache !== 'false';
    const health = await healthService.getSystemHealth(useCache);
    const responseTime = Date.now() - startTime;

    // Record metrics
    healthService.recordRequest(responseTime, health.status === 'unhealthy');

    // Set appropriate HTTP status code
    let statusCode = 200;
    if (health.status === 'degraded') {
      statusCode = 503; // Service Unavailable
    } else if (health.status === 'unhealthy') {
      statusCode = 503; // Service Unavailable
    }

    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: health,
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/health'
      }
    });

    logger.debug('[HealthAPI] Health check completed', {
      status: health.status,
      responseTime,
      cached: useCache
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    healthService.recordRequest(responseTime, true);

    logger.error('[HealthAPI] Health check failed', {
      error: errorMessage,
      responseTime
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Health check system failure',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/health'
      }
    });
  }
});

/**
 * @route GET /health/quick
 * @desc Get quick health status (minimal checks)
 * @access Public
 */
router.get('/quick', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const health = await healthService.getQuickHealth();
    const responseTime = Date.now() - startTime;

    healthService.recordRequest(responseTime, health.status !== 'healthy');

    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: {
        status: health.status,
        uptime: health.uptime,
        timestamp: new Date().toISOString()
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/health/quick'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    healthService.recordRequest(responseTime, true);

    res.status(500).json({
      success: false,
      error: {
        message: 'Quick health check failed',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/health/quick'
      }
    });
  }
});

/**
 * @route GET /health/detailed
 * @desc Get detailed health information with all components
 * @access Public
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const health = await healthService.getSystemHealth(false); // Force fresh check
    const responseTime = Date.now() - startTime;

    healthService.recordRequest(responseTime, health.status === 'unhealthy');

    res.status(200).json({
      success: true,
      data: {
        ...health,
        checkDuration: responseTime,
        detailedCheck: true
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/health/detailed'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    healthService.recordRequest(responseTime, true);

    res.status(500).json({
      success: false,
      error: {
        message: 'Detailed health check failed',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/health/detailed'
      }
    });
  }
});

/**
 * @route GET /health/components/:component
 * @desc Get health status for a specific component
 * @access Public
 */
router.get('/components/:component', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  const componentName = req.params.component;
  
  try {
    const health = await healthService.getSystemHealth();
    const responseTime = Date.now() - startTime;

    const component = health.components[componentName as keyof typeof health.components];
    
    if (!component) {
      res.status(404).json({
        success: false,
        error: {
          message: `Component '${componentName}' not found`,
          availableComponents: Object.keys(health.components)
        },
        meta: {
          responseTime,
          timestamp: new Date().toISOString(),
          endpoint: `/health/components/${componentName}`
        }
      });
      return;
    }

    healthService.recordRequest(responseTime, component.status === 'unhealthy');

    const statusCode = component.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: component.status === 'healthy',
      data: {
        component: componentName,
        ...component
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/health/components/${componentName}`
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    healthService.recordRequest(responseTime, true);

    res.status(500).json({
      success: false,
      error: {
        message: `Component health check failed for '${componentName}'`,
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/health/components/${componentName}`
      }
    });
  }
});

/**
 * @route GET /health/readiness
 * @desc Kubernetes readiness probe - checks if service is ready to accept traffic
 * @access Public
 */
router.get('/readiness', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const health = await healthService.getSystemHealth();
    const responseTime = Date.now() - startTime;

    // Service is ready if database is healthy and no critical components are unhealthy
    const isReady = health.components.database.status !== 'unhealthy' &&
                   health.status !== 'unhealthy';

    healthService.recordRequest(responseTime, !isReady);

    const statusCode = isReady ? 200 : 503;
    const status = isReady ? 'ready' : 'not_ready';

    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database: health.components.database.status,
        overall: health.status
      },
      uptime: health.uptime,
      responseTime
    });

    logger.debug('[HealthAPI] Readiness probe', {
      status,
      responseTime,
      isReady
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    healthService.recordRequest(responseTime, true);

    logger.error('[HealthAPI] Readiness probe failed', {
      error: errorMessage,
      responseTime
    });

    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: errorMessage,
      responseTime
    });
  }
});

/**
 * @route GET /health/liveness
 * @desc Kubernetes liveness probe - checks if service is alive
 * @access Public
 */
router.get('/liveness', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Simple liveness check - just verify the process is responsive
    const health = await healthService.getQuickHealth();
    const responseTime = Date.now() - startTime;

    healthService.recordRequest(responseTime, false);

    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: health.uptime,
      pid: process.pid,
      responseTime
    });

    logger.debug('[HealthAPI] Liveness probe', {
      status: 'alive',
      responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    healthService.recordRequest(responseTime, true);

    logger.error('[HealthAPI] Liveness probe failed', {
      error: errorMessage,
      responseTime
    });

    res.status(503).json({
      status: 'not_alive',
      timestamp: new Date().toISOString(),
      error: errorMessage,
      responseTime
    });
  }
});

/**
 * @route GET /health/metrics
 * @desc Get system metrics and performance data
 * @access Public
 */
router.get('/metrics', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const health = await healthService.getSystemHealth();
    const responseTime = Date.now() - startTime;

    healthService.recordRequest(responseTime, false);

    res.status(200).json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        uptime: health.uptime,
        version: health.version,
        metrics: health.metrics,
        performance: {
          memoryUsage: health.components.memory.details,
          cpuUsage: health.components.cpu.details,
          responseTime
        },
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/health/metrics'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    healthService.recordRequest(responseTime, true);

    res.status(500).json({
      success: false,
      error: {
        message: 'Metrics collection failed',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/health/metrics'
      }
    });
  }
});

/**
 * @route GET /health/status
 * @desc Simple text-based health status (for simple monitoring tools)
 * @access Public
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const health = await healthService.getQuickHealth();
    
    // Return plain text response
    res.set('Content-Type', 'text/plain');
    
    if (health.status === 'healthy') {
      res.status(200).send('OK');
    } else {
      res.status(503).send('UNHEALTHY');
    }
  } catch (error) {
    res.set('Content-Type', 'text/plain');
    res.status(500).send('ERROR');
  }
});

/**
 * @route POST /health/test
 * @desc Test endpoint to simulate different health states (development only)
 * @access Public
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/test', async (req: Request, res: Response) => {
    const { action } = req.body;
    
    try {
      switch (action) {
        case 'simulate_error':
          // Simulate an error for testing
          throw new Error('Simulated health check error');
          
        case 'force_refresh':
          // Force refresh health cache
          const health = await healthService.getSystemHealth(false);
          res.json({
            success: true,
            message: 'Health cache refreshed',
            data: health
          });
          break;
          
        default:
          res.status(400).json({
            success: false,
            error: 'Invalid test action',
            availableActions: ['simulate_error', 'force_refresh']
          });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          message: 'Health test failed',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });
}

export default router;
