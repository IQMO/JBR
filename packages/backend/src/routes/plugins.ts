/**
 * Strategy Plugin Management API Routes
 * 
 * REST API endpoints for managing custom strategy plugins
 */

import fs from 'fs/promises';
import path from 'path';

import { Router } from 'express';
import multer from 'multer';

import logger from '../services/logging.service';
import { strategyPluginManager } from '../strategies/plugin-manager';
import { strategyFactory } from '../strategies/strategy-factory';

const router = Router();

// Configure multer for plugin file uploads
const upload = multer({
  dest: 'temp-uploads/',
  fileFilter: (req, file, cb: multer.FileFilterCallback) => {
    // Only allow .ts and .js files
    if (file.mimetype === 'application/typescript' || 
        file.mimetype === 'application/javascript' ||
        file.originalname.endsWith('.ts') ||
        file.originalname.endsWith('.js')) {
      cb(null, true);
    } else {
      cb(new Error('Only TypeScript (.ts) and JavaScript (.js) files are allowed'));
    }
  },
  limits: {
    fileSize: 1024 * 1024 // 1MB limit
  }
});

/**
 * GET /api/plugins
 * Get all available plugins
 */
router.get('/', async (req, res) => {
  try {
    const plugins = strategyFactory.getAvailablePlugins();
    const builtInStrategies = strategyFactory.getBuiltInStrategies();
    
    res.json({
      success: true,
      data: {
        plugins,
        builtInStrategies,
        total: plugins.length
      }
    });
  } catch (error) {
    logger.error('Failed to get plugins', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve plugins',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/plugins/search
 * Search plugins by criteria
 */
router.get('/search', async (req, res) => {
  try {
    const { name, category, riskLevel, supportedMarket, tags } = req.query;
    
    const criteria: any = {};
    if (name) {criteria.name = name as string;}
    if (category) {criteria.category = category as string;}
    if (riskLevel) {criteria.riskLevel = riskLevel as string;}
    if (supportedMarket) {criteria.supportedMarket = supportedMarket as string;}
    if (tags) {criteria.tags = (tags as string).split(',');}
    
    const results = strategyFactory.searchPlugins(criteria);
    
    res.json({
      success: true,
      data: {
        results,
        count: results.length,
        criteria
      }
    });
  } catch (error) {
    logger.error('Failed to search plugins', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to search plugins',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/plugins/:pluginId
 * Get specific plugin details
 */
router.get('/:pluginId', async (req, res) => {
  try {
    const { pluginId } = req.params;
    const plugin = strategyPluginManager.getPlugin(pluginId);
    if (!plugin) {
      res.status(404).json({
        success: false,
        error: 'Plugin not found'
      });
      return;
    }
    res.json({
      success: true,
      data: plugin
    });
    
  } catch (error) {
    logger.error('Failed to get plugin details', { error, pluginId: req.params.pluginId });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve plugin details',
      details: error instanceof Error ? error.message : String(error)
    });
    
  }
});

/**
 * POST /api/plugins/upload
 * Upload and register a new plugin
 */
router.post('/upload', upload.single('plugin'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No plugin file provided'
      });
      return;
    }

    const tempFilePath = req.file.path;
    const originalFileName = req.file.originalname;
    
    // Validate and sanitize filename
    if (!originalFileName || typeof originalFileName !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid filename provided'
      });
      return;
    }
    
    // Remove dangerous characters and ensure .js/.ts extension
    const sanitizedFileName = path.basename(originalFileName).replace(/[^a-zA-Z0-9._-]/g, '');
    if (!sanitizedFileName.match(/\.(js|ts)$/)) {
      res.status(400).json({
        success: false,
        error: 'Only .js and .ts files are allowed'
      });
      return;
    }
    
    const pluginsDir = path.resolve(process.cwd(), 'plugins');
    const finalFilePath = path.join(pluginsDir, sanitizedFileName);
    
    // Ensure final path is within plugins directory
    if (!path.resolve(finalFilePath).startsWith(pluginsDir)) {
      res.status(400).json({
        success: false,
        error: 'Invalid file path'
      });
      return;
    }

    try {
      // Ensure plugins directory exists
      await fs.mkdir(pluginsDir, { recursive: true });
      
      // Move file to plugins directory
      await fs.rename(tempFilePath, finalFilePath);
      
      // Register the plugin
      const pluginId = await strategyFactory.registerPlugin(finalFilePath);
      
      // Get plugin details
      const plugin = strategyPluginManager.getPlugin(pluginId);
      
      logger.info(`Plugin uploaded and registered successfully`, { 
        pluginId, 
        fileName: sanitizedFileName,
        uploader: req.ip 
      });
      
      res.status(201).json({
        success: true,
        message: 'Plugin uploaded and registered successfully',
        data: {
          pluginId,
          plugin
        }
      });
    } catch (registrationError) {
      // Clean up file if registration failed
      try {
        await fs.unlink(finalFilePath);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup file after registration failure', { 
          filePath: finalFilePath, 
          error: cleanupError 
        });
      }
      throw registrationError;
    }
  } catch (error) {
    // Clean up temp file
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup temp file', { filePath: req.file.path, error: cleanupError });
      }
    }
    
    logger.error('Failed to upload plugin', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to upload and register plugin',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/plugins/:pluginId/validate
 * Validate plugin configuration
 */
router.post('/:pluginId/validate', async (req, res) => {
  try {
    const { pluginId } = req.params;
    const { config } = req.body;
    if (!config) {
      res.status(400).json({
        success: false,
        error: 'Configuration is required'
      });
      return;
    }
    const validation = await strategyPluginManager.validatePluginConfig(pluginId, config);
    res.json({
      success: true,
      data: validation
    });
    
  } catch (error) {
    logger.error('Failed to validate plugin config', { error, pluginId: req.params.pluginId });
    res.status(500).json({
      success: false,
      error: 'Failed to validate plugin configuration',
      details: error instanceof Error ? error.message : String(error)
    });
    
  }
});

/**
 * GET /api/plugins/:pluginId/default-config
 * Get default configuration for a plugin
 */
router.get('/:pluginId/default-config', async (req, res) => {
  try {
    const { pluginId } = req.params;
    const defaultConfig = await strategyFactory.getDefaultConfig('custom', pluginId);
    
    res.json({
      success: true,
      data: defaultConfig
    });
  } catch (error) {
    logger.error('Failed to get default config', { error, pluginId: req.params.pluginId });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve default configuration',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/plugins/:pluginId/unload
 * Unload a plugin
 */
router.post('/:pluginId/unload', async (req, res) => {
  try {
    const { pluginId } = req.params;
    
    await strategyFactory.unloadPlugin(pluginId);
    
    logger.info(`Plugin unloaded successfully`, { pluginId, requester: req.ip });
    
    res.json({
      success: true,
      message: 'Plugin unloaded successfully'
    });
  } catch (error) {
    logger.error('Failed to unload plugin', { error, pluginId: req.params.pluginId });
    res.status(500).json({
      success: false,
      error: 'Failed to unload plugin',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * DELETE /api/plugins/:pluginId
 * Delete a plugin (unload and remove file)
 */
router.delete('/:pluginId', async (req, res) => {
  try {
    const { pluginId } = req.params;
    // Get plugin info before deletion
    const plugin = strategyPluginManager.getPlugin(pluginId);
    if (!plugin) {
      res.status(404).json({
        success: false,
        error: 'Plugin not found'
      });
      return;
    }
    // Unload plugin first
    await strategyFactory.unloadPlugin(pluginId);
    // Remove plugin file
    try {
      await fs.unlink(plugin.filePath);
    } catch (fileError) {
      logger.warn('Failed to delete plugin file', { filePath: plugin.filePath, error: fileError });
    }
    logger.info(`Plugin deleted successfully`, { 
      pluginId, 
      fileName: path.basename(plugin.filePath),
      requester: req.ip 
    });
    res.json({
      success: true,
      message: 'Plugin deleted successfully'
    });
    
  } catch (error) {
    logger.error('Failed to delete plugin', { error, pluginId: req.params.pluginId });
    res.status(500).json({
      success: false,
      error: 'Failed to delete plugin',
      details: error instanceof Error ? error.message : String(error)
    });
    
  }
});

/**
 * GET /api/plugins/categories
 * Get available plugin categories
 */
router.get('/categories', async (req, res) => {
  try {
    const plugins = strategyFactory.getAvailablePlugins();
    const categories = [...new Set(plugins.map(p => p.category))].sort();
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    logger.error('Failed to get plugin categories', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve plugin categories',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/plugins/stats
 * Get plugin statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const plugins = strategyFactory.getAvailablePlugins();
    const builtInStrategies = strategyFactory.getBuiltInStrategies();
    
    const stats = {
      totalPlugins: plugins.length,
      loadedPlugins: plugins.filter(p => p.isLoaded).length,
      errorPlugins: plugins.filter(p => p.error).length,
      builtInStrategies: builtInStrategies.length,
      categories: [...new Set(plugins.map(p => p.category))].length,
      riskLevels: {
        low: plugins.filter(p => p.riskLevel === 'low').length,
        medium: plugins.filter(p => p.riskLevel === 'medium').length,
        high: plugins.filter(p => p.riskLevel === 'high').length
      }
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get plugin stats', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve plugin statistics',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router; 