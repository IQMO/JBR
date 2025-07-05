import { Request, Response, Router } from 'express';
import { database } from '../database/database.config';
import logger from '../services/logging.service';
import type { LogEntry } from '@jabbr/shared';

const router = Router();

/**
 * Get logs with filtering and pagination
 */
const getLogs = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const {
      page = '1',
      limit = '50',
      levels,
      categories,
      search,
      startDate,
      endDate,
      userId,
      botId,
      tradeId
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build dynamic query
    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    // Level filter
    if (levels) {
      const levelArray = (levels as string).split(',');
      whereConditions.push(`level = ANY($${paramIndex})`);
      queryParams.push(levelArray);
      paramIndex++;
    }

    // Category filter
    if (categories) {
      const categoryArray = (categories as string).split(',');
      whereConditions.push(`category = ANY($${paramIndex})`);
      queryParams.push(categoryArray);
      paramIndex++;
    }

    // Search filter
    if (search) {
      whereConditions.push(`(message ILIKE $${paramIndex} OR category ILIKE $${paramIndex + 1})`);
      queryParams.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    // Date range filter
    if (startDate) {
      whereConditions.push(`timestamp >= $${paramIndex}`);
      queryParams.push(new Date(startDate as string));
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`timestamp <= $${paramIndex}`);
      queryParams.push(new Date(endDate as string));
      paramIndex++;
    }

    // User filter
    if (userId) {
      whereConditions.push(`user_id = $${paramIndex}`);
      queryParams.push(userId);
      paramIndex++;
    }

    // Bot filter
    if (botId) {
      whereConditions.push(`bot_id = $${paramIndex}`);
      queryParams.push(botId);
      paramIndex++;
    }

    // Trade filter
    if (tradeId) {
      whereConditions.push(`trade_id = $${paramIndex}`);
      queryParams.push(tradeId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM logs 
      ${whereClause}
    `;

    const countResult = await database.query(countQuery, queryParams);
    const total = parseInt((countResult as any).rows[0].total, 10);

    // Get logs with pagination
    const logsQuery = `
      SELECT 
        id,
        level,
        message,
        category,
        user_id as "userId",
        bot_id as "botId", 
        trade_id as "tradeId",
        metadata,
        timestamp
      FROM logs 
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limitNum, offset);

    const logsResult = await database.query(logsQuery, queryParams);
    
    const logs: LogEntry[] = (logsResult as any).rows.map((row: any) => ({
      id: row.id,
      level: row.level,
      message: row.message,
      category: row.category,
      userId: row.userId,
      botId: row.botId,
      tradeId: row.tradeId,
      metadata: row.metadata,
      timestamp: new Date(row.timestamp)
    }));

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        logs,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/api/logs'
      }
    });

    logger.info('Logs retrieved successfully', {
      total,
      page: pageNum,
      limit: limitNum,
      filters: {
        levels,
        categories,
        search,
        startDate,
        endDate,
        userId,
        botId,
        tradeId
      },
      responseTime
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to retrieve logs', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve logs',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/api/logs'
      }
    });
  }
};

/**
 * Get log statistics
 */
const getLogStats = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const { timeRange = '24h' } = req.query;

    // Calculate time window
    let timeWindow: Date;
    switch (timeRange) {
      case '1h':
        timeWindow = new Date(Date.now() - 60 * 60 * 1000);
        break;
      case '6h':
        timeWindow = new Date(Date.now() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        timeWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        timeWindow = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    // Get stats by level
    const levelStatsQuery = `
      SELECT 
        level,
        COUNT(*) as count,
        MAX(timestamp) as latest
      FROM logs 
      WHERE timestamp >= $1
      GROUP BY level
      ORDER BY count DESC
    `;

    const levelStatsResult = await database.query(levelStatsQuery, [timeWindow]);

    // Get stats by category
    const categoryStatsQuery = `
      SELECT 
        category,
        COUNT(*) as count,
        MAX(timestamp) as latest
      FROM logs 
      WHERE timestamp >= $1
      GROUP BY category
      ORDER BY count DESC
      LIMIT 10
    `;

    const categoryStatsResult = await database.query(categoryStatsQuery, [timeWindow]);

    // Get hourly distribution
    const hourlyStatsQuery = `
      SELECT 
        DATE_TRUNC('hour', timestamp) as hour,
        level,
        COUNT(*) as count
      FROM logs 
      WHERE timestamp >= $1
      GROUP BY hour, level
      ORDER BY hour DESC
    `;

    const hourlyStatsResult = await database.query(hourlyStatsQuery, [timeWindow]);

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        timeRange,
        timeWindow: timeWindow.toISOString(),
        levelStats: (levelStatsResult as any).rows,
        categoryStats: (categoryStatsResult as any).rows,
        hourlyStats: (hourlyStatsResult as any).rows
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/api/logs/stats'
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to retrieve log statistics', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve log statistics',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/api/logs/stats'
      }
    });
  }
};

// Define routes
router.get('/', getLogs);
router.get('/stats', getLogStats);

export default router;
