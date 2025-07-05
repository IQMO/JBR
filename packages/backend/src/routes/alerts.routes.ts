import { Request, Response, Router } from 'express';
import AlertManagerService from '../services/alert-manager.service';
import logger from '../services/logging.service';

const router = Router();

// Initialize alert manager (it will be properly initialized in server.ts with WebSocket server)
let alertManager: AlertManagerService;

/**
 * Initialize alert manager with WebSocket server
 */
export const initializeAlertsRoutes = (alertManagerInstance: AlertManagerService): void => {
  alertManager = alertManagerInstance;
};

/**
 * Get all alerts with optional filtering
 */
const getAlerts = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    if (!alertManager) {
      res.status(503).json({
        success: false,
        error: {
          message: 'Alert manager not initialized',
          code: 'SERVICE_UNAVAILABLE'
        }
      });
      return;
    }

    const {
      type,
      level,
      category,
      acknowledged,
      resolved,
      escalated,
      since
    } = req.query;

    // Build filter criteria
    const criteria: any = {};
    
    if (type) criteria.type = type as string;
    if (level) criteria.level = level as string;
    if (category) criteria.category = category as string;
    if (acknowledged !== undefined) criteria.acknowledged = acknowledged === 'true';
    if (resolved !== undefined) criteria.resolved = resolved === 'true';
    if (escalated !== undefined) criteria.escalated = escalated === 'true';
    if (since) criteria.since = new Date(since as string);

    const alerts = alertManager.getAlerts(criteria);
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        alerts,
        total: alerts.length
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/api/alerts'
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to retrieve alerts', { error: errorMessage });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve alerts',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/api/alerts'
      }
    });
  }
};

/**
 * Get active alerts only
 */
const getActiveAlerts = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    if (!alertManager) {
      res.status(503).json({
        success: false,
        error: {
          message: 'Alert manager not initialized',
          code: 'SERVICE_UNAVAILABLE'
        }
      });
      return;
    }

    const alerts = alertManager.getActiveAlerts();
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        alerts,
        total: alerts.length
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/api/alerts/active'
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to retrieve active alerts', { error: errorMessage });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve active alerts',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/api/alerts/active'
      }
    });
  }
};

/**
 * Get alert statistics
 */
const getAlertStats = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    if (!alertManager) {
      res.status(503).json({
        success: false,
        error: {
          message: 'Alert manager not initialized',
          code: 'SERVICE_UNAVAILABLE'
        }
      });
      return;
    }

    const stats = alertManager.getAlertStats();
    const summary = alertManager.getAlertSummary();
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        stats,
        summary
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/api/alerts/stats'
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to retrieve alert statistics', { error: errorMessage });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve alert statistics',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/api/alerts/stats'
      }
    });
  }
};

/**
 * Acknowledge an alert
 */
const acknowledgeAlert = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    if (!alertManager) {
      res.status(503).json({
        success: false,
        error: {
          message: 'Alert manager not initialized',
          code: 'SERVICE_UNAVAILABLE'
        }
      });
      return;
    }

    const { alertId } = req.params;
    const { acknowledgedBy = 'system' } = req.body;

    if (!alertId) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Alert ID is required',
          code: 'MISSING_ALERT_ID'
        }
      });
      return;
    }

    const updatedAlert = alertManager.acknowledgeAlert(alertId, acknowledgedBy);
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        alert: updatedAlert
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/api/alerts/${alertId}/acknowledge`
      }
    });

    logger.info('Alert acknowledged', {
      alertId,
      acknowledgedBy,
      title: updatedAlert.title
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to acknowledge alert', { 
      alertId: req.params.alertId,
      error: errorMessage 
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to acknowledge alert',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/api/alerts/${req.params.alertId}/acknowledge`
      }
    });
  }
};

/**
 * Resolve an alert
 */
const resolveAlert = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    if (!alertManager) {
      res.status(503).json({
        success: false,
        error: {
          message: 'Alert manager not initialized',
          code: 'SERVICE_UNAVAILABLE'
        }
      });
      return;
    }

    const { alertId } = req.params;

    if (!alertId) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Alert ID is required',
          code: 'MISSING_ALERT_ID'
        }
      });
      return;
    }

    const updatedAlert = alertManager.resolveAlert(alertId);
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        alert: updatedAlert
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/api/alerts/${alertId}/resolve`
      }
    });

    logger.info('Alert resolved', {
      alertId,
      title: updatedAlert.title,
      duration: updatedAlert.resolvedAt ? 
        updatedAlert.resolvedAt.getTime() - updatedAlert.timestamp.getTime() : 0
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to resolve alert', { 
      alertId: req.params.alertId,
      error: errorMessage 
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to resolve alert',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/api/alerts/${req.params.alertId}/resolve`
      }
    });
  }
};

/**
 * Escalate an alert
 */
const escalateAlert = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    if (!alertManager) {
      res.status(503).json({
        success: false,
        error: {
          message: 'Alert manager not initialized',
          code: 'SERVICE_UNAVAILABLE'
        }
      });
      return;
    }

    const { alertId } = req.params;

    if (!alertId) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Alert ID is required',
          code: 'MISSING_ALERT_ID'
        }
      });
      return;
    }

    const updatedAlert = alertManager.escalateAlert(alertId);
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        alert: updatedAlert
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/api/alerts/${alertId}/escalate`
      }
    });

    logger.warn('Alert escalated', {
      alertId,
      title: updatedAlert.title
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to escalate alert', { 
      alertId: req.params.alertId,
      error: errorMessage 
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to escalate alert',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/api/alerts/${req.params.alertId}/escalate`
      }
    });
  }
};

/**
 * Create a new alert
 */
const createAlert = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    if (!alertManager) {
      res.status(503).json({
        success: false,
        error: {
          message: 'Alert manager not initialized',
          code: 'SERVICE_UNAVAILABLE'
        }
      });
      return;
    }

    const alertData = req.body;

    // Validate required fields
    if (!alertData.type || !alertData.category || !alertData.level || !alertData.title || !alertData.message || !alertData.source) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Missing required alert fields',
          details: 'type, category, level, title, message, and source are required'
        }
      });
      return;
    }

    const alert = alertManager.createAlert(alertData);
    const responseTime = Date.now() - startTime;

    res.status(201).json({
      success: true,
      data: {
        alert
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/api/alerts'
      }
    });

    logger.info('Alert created', {
      id: alert.id,
      type: alert.type,
      level: alert.level,
      title: alert.title
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to create alert', { error: errorMessage });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create alert',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/api/alerts'
      }
    });
  }
};

// Define routes
router.get('/', getAlerts);
router.get('/active', getActiveAlerts);
router.get('/stats', getAlertStats);
router.post('/', createAlert);
router.post('/:alertId/acknowledge', acknowledgeAlert);
router.post('/:alertId/resolve', resolveAlert);
router.post('/:alertId/escalate', escalateAlert);

export default router;
