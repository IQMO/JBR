import type { WebSocketResponse } from '@jabbr/shared/src';
import { CONSTANTS } from '@jabbr/shared/src';
import {
  Check as AckIcon,
  CheckCircle,
  CheckCircle as ResolvedIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Schedule as PendingIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useState, useEffect, useMemo, useCallback } from 'react';

import useWebSocket from '../hooks/useWebSocket';
import { apiService } from '../services/api';

interface Alert {
  id: string;
  type: 'system' | 'application' | 'trading' | 'security' | 'custom';
  category: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  source: string;
  value?: number;
  threshold?: number;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
  escalated: boolean;
  escalatedAt?: Date;
  notificationsSent?: string[];
}

interface AlertSystemProps {
  height?: number;
  showResolved?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const ALERT_LEVELS = [
  { value: 'info', label: 'Info', color: '#2196f3', icon: InfoIcon },
  { value: 'warning', label: 'Warning', color: '#ff9800', icon: WarningIcon },
  { value: 'error', label: 'Error', color: '#f44336', icon: ErrorIcon },
  { value: 'critical', label: 'Critical', color: '#d32f2f', icon: ErrorIcon }
];

export const AlertSystem: React.FC<AlertSystemProps> = ({
  height = 600,
  showResolved = false,
  autoRefresh = true,
  refreshInterval = 30000
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  // Note: showAckDialog removed as it was unused

  // WebSocket message handler
  function handleWebSocketMessage(message: WebSocketResponse) {
    if (message.channel === 'alerts' && message.type === 'data' && message.data) {
      const alert = message.data as Alert;
      setAlerts(prev => {
        const existing = prev.find(a => a.id === alert.id);
        if (existing) {
          return prev.map(a => a.id === alert.id ? alert : a);
        }
        return [alert, ...prev];
      });
    }
  }

  // WebSocket connection for real-time alert updates
  const { isConnected, subscribe } = useWebSocket({
    url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002',
    token: typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined,
    onMessage: handleWebSocketMessage,
    onOpen: () => {
      subscribe(CONSTANTS.WS_CHANNELS.ALERTS || 'alerts');
      subscribe(CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH);
    }
  });

  // Fetch alerts from API
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiService.getAlerts();
      if (response.success) {
        setAlerts(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh alerts
  useEffect(() => {
    void fetchAlerts();
    
    if (autoRefresh) {
      const interval = setInterval(() => void fetchAlerts(), refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchAlerts, autoRefresh, refreshInterval]);

  // Filter alerts based on showResolved flag
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => showResolved || !alert.resolved);
  }, [alerts, showResolved]);

  // Group alerts by level
  const alertsByLevel = useMemo(() => {
    return ALERT_LEVELS.reduce((acc, level) => {
      acc[level.value] = filteredAlerts.filter(alert => alert.level === level.value);
      return acc;
    }, {} as Record<string, Alert[]>);
  }, [filteredAlerts]);

  // Get alert level configuration
  const getAlertLevelConfig = (level: string) => {
    return ALERT_LEVELS.find(l => l.value === level) || ALERT_LEVELS[0];
  };

  // Acknowledge alert
  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await apiService.acknowledgeAlert(alertId);
      if (response.success) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, acknowledged: true, acknowledgedAt: new Date() }
            : alert
        ));
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  // Resolve alert
  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, resolved: true, resolvedAt: new Date() }
            : alert
        ));
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  // Get alert counts
  const alertCounts = useMemo(() => {
    return {
      total: filteredAlerts.length,
      unacknowledged: filteredAlerts.filter(a => !a.acknowledged).length,
      unresolved: filteredAlerts.filter(a => !a.resolved).length,
      critical: filteredAlerts.filter(a => a.level === 'critical').length
    };
  }, [filteredAlerts]);

  return (
    <Card sx={{ height, display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexShrink: 0, pb: 1 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6" component="h2">
              Alert System
            </Typography>
            {isConnected && (
              <Chip 
                label="Live" 
                color="success" 
                size="small" 
                variant="outlined"
              />
            )}
          </Box>
          
          <Box display="flex" gap={1}>
            <Tooltip title="Refresh alerts">
              <IconButton onClick={() => void fetchAlerts()} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Alert Summary */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 2 }}>
          <Paper sx={{ p: 1, textAlign: 'center' }} variant="outlined">
            <Typography variant="h6" color="primary">
              {alertCounts.total}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total
            </Typography>
          </Paper>
          <Paper sx={{ p: 1, textAlign: 'center' }} variant="outlined">
            <Typography variant="h6" color="error">
              {alertCounts.critical}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Critical
            </Typography>
          </Paper>
          <Paper sx={{ p: 1, textAlign: 'center' }} variant="outlined">
            <Typography variant="h6" color="warning.main">
              {alertCounts.unacknowledged}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Unacked
            </Typography>
          </Paper>
          <Paper sx={{ p: 1, textAlign: 'center' }} variant="outlined">
            <Typography variant="h6" color="info.main">
              {alertCounts.unresolved}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Active
            </Typography>
          </Paper>
        </Box>

        {/* Level Filters */}
        <Box display="flex" gap={1} mb={2} flexWrap="wrap">
          {ALERT_LEVELS.map((level) => (
            <Chip
              key={level.value}
              label={`${level.label} (${alertsByLevel[level.value]?.length || 0})`}
              size="small"
              sx={{ 
                borderColor: level.color,
                color: level.color,
                '&:hover': {
                  backgroundColor: level.color,
                  color: 'white'
                }
              }}
              variant="outlined"
            />
          ))}
        </Box>
      </CardContent>

      {/* Alerts List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', px: 2 }}>
        <List dense>
          {ALERT_LEVELS.map((level) => {
            const levelAlerts = alertsByLevel[level.value] || [];
            if (levelAlerts.length === 0) {
              return null;
            }

            return (
              <Accordion key={level.value} defaultExpanded={level.value === 'critical' || level.value === 'error'}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <level.icon sx={{ color: level.color, fontSize: 20 }} />
                    <Typography variant="subtitle2">
                      {level.label} Alerts
                    </Typography>
                    <Badge badgeContent={levelAlerts.length} color="primary" />
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  {levelAlerts.map((alert, index) => {
                    const config = getAlertLevelConfig(alert.level);
                    
                    return (
                      <React.Fragment key={alert.id}>
                        <ListItem 
                          sx={{ 
                            px: 1,
                            borderLeft: `3px solid ${config.color}`,
                            backgroundColor: alert.acknowledged ? 'grey.50' : 'background.paper',
                            opacity: alert.resolved ? 0.6 : 1
                          }}
                        >
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                  {alert.title}
                                </Typography>
                                
                                {/* Status indicators */}
                                {alert.resolved && (
                                  <Chip 
                                    label="Resolved" 
                                    size="small" 
                                    color="success"
                                    icon={<ResolvedIcon />}
                                  />
                                )}
                                {alert.acknowledged && !alert.resolved && (
                                  <Chip 
                                    label="Acknowledged" 
                                    size="small" 
                                    color="info"
                                    icon={<AckIcon />}
                                  />
                                )}
                                {!alert.acknowledged && !alert.resolved && (
                                  <Chip 
                                    label="New" 
                                    size="small" 
                                    color="warning"
                                    icon={<PendingIcon />}
                                  />
                                )}
                                
                                <Chip 
                                  label={alert.category} 
                                  size="small" 
                                  variant="outlined"
                                />
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                  {alert.message}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {alert.source} • {new Date(alert.timestamp).toLocaleString()}
                                </Typography>
                              </Box>
                            }
                          />
                          
                          <ListItemSecondaryAction>
                            <Stack direction="row" spacing={1}>
                              {!alert.acknowledged && (
                                <Tooltip title="Acknowledge">
                                  <IconButton 
                                    size="small" 
                                    color="primary"
                                    onClick={() => void acknowledgeAlert(alert.id)}
                                  >
                                    <AckIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                              
                              {!alert.resolved && (
                                <Tooltip title="Resolve">
                                  <IconButton 
                                    size="small" 
                                    color="success"
                                    onClick={() => void resolveAlert(alert.id).catch((error) => {
                                      console.error('Failed to resolve alert:', error);
                                    })}
                                  >
                                    <ResolvedIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                              
                              <Tooltip title="View Details">
                                <IconButton 
                                  size="small"
                                  onClick={() => setSelectedAlert(alert)}
                                >
                                  <InfoIcon />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </ListItemSecondaryAction>
                        </ListItem>
                        
                        {index < levelAlerts.length - 1 && <Divider />}
                      </React.Fragment>
                    );
                  })}
                </AccordionDetails>
              </Accordion>
            );
          })}
        </List>

        {/* Empty State */}
        {filteredAlerts.length === 0 && !loading && (
          <Box 
            display="flex" 
            flexDirection="column" 
            alignItems="center" 
            justifyContent="center"
            sx={{ height: 200 }}
          >
            <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No active alerts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              All systems are running normally
            </Typography>
          </Box>
        )}
      </Box>

      {/* Alert Details Dialog */}
      <Dialog 
        open={Boolean(selectedAlert)} 
        onClose={() => setSelectedAlert(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedAlert && (
          <>
            <DialogTitle>
              <Box display="flex" alignItems="center" gap={1}>
                {React.createElement(getAlertLevelConfig(selectedAlert.level).icon, {
                  sx: { color: getAlertLevelConfig(selectedAlert.level).color }
                })}
                <Typography variant="h6">{selectedAlert.title}</Typography>
                <Chip 
                  label={selectedAlert.level.toUpperCase()} 
                  size="small"
                  sx={{ 
                    backgroundColor: getAlertLevelConfig(selectedAlert.level).color,
                    color: 'white'
                  }}
                />
              </Box>
            </DialogTitle>
            
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="body1" gutterBottom>
                    <strong>Message:</strong> {selectedAlert.message}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                  <Box>
                    <Typography variant="body2">
                      <strong>Source:</strong> {selectedAlert.source}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2">
                      <strong>Category:</strong> {selectedAlert.category}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2">
                      <strong>Timestamp:</strong> {new Date(selectedAlert.timestamp).toLocaleString()}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2">
                      <strong>Status:</strong> {
                        selectedAlert.resolved ? 'Resolved' :
                        selectedAlert.acknowledged ? 'Acknowledged' : 'New'
                      }
                    </Typography>
                  </Box>
                  
                  {selectedAlert.acknowledgedBy && (
                    <Box>
                      <Typography variant="body2">
                        <strong>Acknowledged by:</strong> {selectedAlert.acknowledgedBy}
                      </Typography>
                    </Box>
                  )}
                  
                  {/* Note: resolvedBy removed as it's not in the backend Alert interface */}
                </Box>
                
                {selectedAlert.metadata && (
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      <strong>Additional Details:</strong>
                    </Typography>
                    <Paper sx={{ p: 1, backgroundColor: 'grey.100' }}>
                      <Typography 
                        variant="caption" 
                        component="pre"
                        sx={{ fontSize: '0.8rem' }}
                      >
                        {JSON.stringify(selectedAlert.metadata, null, 2)}
                      </Typography>
                    </Paper>
                  </Box>
                )}
              </Box>
            </DialogContent>
            
            <DialogActions>
              {!selectedAlert.acknowledged && (
                <Button 
                  onClick={() => {
                    void acknowledgeAlert(selectedAlert.id);
                    setSelectedAlert(null);
                  }}
                  color="primary"
                  startIcon={<AckIcon />}
                >
                  Acknowledge
                </Button>
              )}
              
              {!selectedAlert.resolved && (
                <Button 
                  onClick={() => {
                    void resolveAlert(selectedAlert.id).then(() => {
                      setSelectedAlert(null);
                    }).catch((error) => {
                      console.error('Failed to resolve alert:', error);
                    });
                  }}
                  color="success"
                  startIcon={<ResolvedIcon />}
                >
                  Resolve
                </Button>
              )}
              
              <Button onClick={() => setSelectedAlert(null)}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Card>
  );
};
