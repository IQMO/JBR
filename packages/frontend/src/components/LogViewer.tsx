import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Card,
  CardContent,
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  List,
  ListItem,
  Paper,
  Divider,
  Collapse,
  Grid,
  Pagination,
  Tooltip,
  Badge,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  BugReport as DebugIcon
} from '@mui/icons-material';
import useWebSocket from '../hooks/useWebSocket';
import { CONSTANTS } from '@jabbr/shared/src';
import type { LogEntry, WebSocketResponse } from '@jabbr/shared/src';

interface LogViewerProps {
  height?: number;
  showFilters?: boolean;
  realTimeUpdates?: boolean;
  maxEntries?: number;
}

interface LogFilters {
  level: string[];
  category: string[];
  search: string;
  dateRange: {
    start: string;
    end: string;
  };
  userId?: string;
  botId?: string;
}

const LOG_LEVELS = [
  { value: 'debug', label: 'Debug', color: '#9e9e9e', icon: DebugIcon },
  { value: 'info', label: 'Info', color: '#2196f3', icon: InfoIcon },
  { value: 'warn', label: 'Warning', color: '#ff9800', icon: WarningIcon },
  { value: 'error', label: 'Error', color: '#f44336', icon: ErrorIcon }
];

const LOG_CATEGORIES = [
  'system', 'trading', 'websocket', 'bot', 'user', 'exchange', 'database', 'auth', 'api'
];

export const LogViewer: React.FC<LogViewerProps> = ({
  height = 600,
  showFilters = true,
  realTimeUpdates = true,
  maxEntries = 1000
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<LogFilters>({
    level: [],
    category: [],
    search: '',
    dateRange: {
      start: '',
      end: ''
    }
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const logsPerPage = 50;

  // WebSocket message handler
  function handleWebSocketMessage(message: WebSocketResponse) {
    if (message.channel === 'logs' && message.type === 'data' && message.data) {
      const newLog = message.data as LogEntry;
      setLogs(prev => {
        const updated = [newLog, ...prev];
        return updated.slice(0, maxEntries);
      });
    }
  }

  // WebSocket connection for real-time log updates
  const { isConnected, sendMessage, subscribe, unsubscribe } = useWebSocket({
    url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002',
    token: typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined,
    onMessage: handleWebSocketMessage,
    onOpen: () => {
      if (realTimeUpdates) {
        subscribe(CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH);
        subscribe('logs');
      }
    }
  });

  // Fetch logs from API
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: logsPerPage.toString(),
        ...(filters.level.length && { levels: filters.level.join(',') }),
        ...(filters.category.length && { categories: filters.category.join(',') }),
        ...(filters.search && { search: filters.search }),
        ...(filters.dateRange.start && { startDate: filters.dateRange.start }),
        ...(filters.dateRange.end && { endDate: filters.dateRange.end }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.botId && { botId: filters.botId })
      });

      const response = await fetch(`/api/logs?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setTotalPages(Math.ceil((data.total || 0) / logsPerPage));
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }, [page, filters, logsPerPage]);

  // Load logs on component mount and filter changes
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Filter logs based on current filters
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (filters.level.length > 0 && !filters.level.includes(log.level)) {
        return false;
      }
      if (filters.category.length > 0 && !filters.category.includes(log.category)) {
        return false;
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return (
          log.message.toLowerCase().includes(searchLower) ||
          log.category.toLowerCase().includes(searchLower) ||
          (log.metadata && JSON.stringify(log.metadata).toLowerCase().includes(searchLower))
        );
      }
      return true;
    });
  }, [logs, filters]);

  // Get log level configuration
  const getLogLevelConfig = (level: string) => {
    return LOG_LEVELS.find(l => l.value === level) || LOG_LEVELS[1];
  };

  // Toggle log expansion
  const toggleLogExpansion = (logId: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      level: [],
      category: [],
      search: '',
      dateRange: { start: '', end: '' }
    });
    setPage(1);
  };

  // Export logs
  const exportLogs = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Get log count by level for badges
  const logCountsByLevel = useMemo(() => {
    return LOG_LEVELS.reduce((acc, level) => {
      acc[level.value] = filteredLogs.filter(log => log.level === level.value).length;
      return acc;
    }, {} as Record<string, number>);
  }, [filteredLogs]);

  return (
    <Card sx={{ height, display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexShrink: 0, pb: 1 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6" component="h2">
              System Logs
            </Typography>
            {isConnected && (
              <Chip 
                label="Live" 
                color="success" 
                size="small" 
                variant="outlined"
              />
            )}
            <Typography variant="caption" color="text.secondary">
              {filteredLogs.length} logs
            </Typography>
          </Box>
          
          <Box display="flex" gap={1}>
            <Tooltip title="Toggle Filters">
              <IconButton 
                size="small" 
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                color={showFiltersPanel ? 'primary' : 'default'}
              >
                <Badge 
                  badgeContent={
                    filters.level.length + filters.category.length + (filters.search ? 1 : 0)
                  } 
                  color="primary"
                >
                  <FilterIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={fetchLogs} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Export Logs">
              <IconButton size="small" onClick={exportLogs}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Filters Panel */}
        <Collapse in={showFiltersPanel}>
          <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr auto' }, gap: 2 }}>
                {/* Search */}
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search logs..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                    endAdornment: filters.search && (
                      <IconButton
                        size="small"
                        onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                      >
                        <ClearIcon />
                      </IconButton>
                    )
                  }}
                />

                {/* Log Levels */}
                <FormControl fullWidth size="small">
                  <InputLabel>Log Levels</InputLabel>
                  <Select
                    multiple
                    value={filters.level}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      level: e.target.value as string[] 
                    }))}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as string[]).map((value) => {
                          const config = getLogLevelConfig(value);
                          return (
                            <Chip
                              key={value}
                              label={config.label}
                              size="small"
                              sx={{ 
                                backgroundColor: config.color,
                                color: 'white'
                              }}
                            />
                          );
                        })}
                      </Box>
                    )}
                  >
                    {LOG_LEVELS.map((level) => (
                      <MenuItem key={level.value} value={level.value}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <level.icon sx={{ color: level.color, fontSize: 16 }} />
                          <Badge badgeContent={logCountsByLevel[level.value]} color="primary">
                            <Typography>{level.label}</Typography>
                          </Badge>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Categories */}
                <FormControl fullWidth size="small">
                  <InputLabel>Categories</InputLabel>
                  <Select
                    multiple
                    value={filters.category}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      category: e.target.value as string[] 
                    }))}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as string[]).map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {LOG_CATEGORIES.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Clear Filters */}
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Clear all filters">
                    <IconButton size="small" onClick={clearFilters}>
                      <ClearIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>
            </Box>
          </Paper>
        </Collapse>

        {/* Level Summary Chips */}
        <Box display="flex" gap={1} mb={2} flexWrap="wrap">
          {LOG_LEVELS.map((level) => (
            <Chip
              key={level.value}
              label={`${level.label}: ${logCountsByLevel[level.value]}`}
              size="small"
              variant={filters.level.includes(level.value) ? "filled" : "outlined"}
              sx={{ 
                backgroundColor: filters.level.includes(level.value) ? level.color : 'transparent',
                borderColor: level.color,
                color: filters.level.includes(level.value) ? 'white' : level.color,
                '&:hover': {
                  backgroundColor: level.color,
                  color: 'white'
                }
              }}
              onClick={() => {
                setFilters(prev => ({
                  ...prev,
                  level: prev.level.includes(level.value) 
                    ? prev.level.filter(l => l !== level.value)
                    : [...prev.level, level.value]
                }));
              }}
            />
          ))}
        </Box>
      </CardContent>

      {/* Logs List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', px: 2 }}>
        <List dense>
          {filteredLogs.map((log, index) => {
            const config = getLogLevelConfig(log.level);
            const isExpanded = expandedLogs.has(log.id);
            
            return (
              <React.Fragment key={log.id}>
                <ListItem 
                  sx={{ 
                    px: 1,
                    py: 0.5,
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'action.hover' },
                    borderLeft: `3px solid ${config.color}`,
                    borderRadius: 1,
                    mb: 0.5
                  }}
                  onClick={() => toggleLogExpansion(log.id)}
                >
                  <Box sx={{ width: '100%' }}>
                    <Box display="flex" justifyContent="between" alignItems="center">
                      <Box display="flex" alignItems="center" gap={1} sx={{ minWidth: 0, flexGrow: 1 }}>
                        <config.icon sx={{ color: config.color, fontSize: 16 }} />
                        
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </Typography>
                        
                        <Chip 
                          label={log.category}
                          size="small"
                          variant="outlined"
                          sx={{ minWidth: 80, fontSize: '0.7rem' }}
                        />
                        
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            flexGrow: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {log.message}
                        </Typography>
                      </Box>
                      
                      <IconButton size="small">
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Box>

                    {/* Expanded Details */}
                    <Collapse in={isExpanded}>
                      <Box sx={{ mt: 1, p: 1, backgroundColor: 'grey.50', borderRadius: 1 }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                          <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                              <strong>Message:</strong> {log.message}
                            </Typography>
                          </Box>
                          
                          {log.userId && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                <strong>User ID:</strong> {log.userId}
                              </Typography>
                            </Box>
                          )}
                          
                          {log.botId && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                <strong>Bot ID:</strong> {log.botId}
                              </Typography>
                            </Box>
                          )}
                          
                          {log.tradeId && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                <strong>Trade ID:</strong> {log.tradeId}
                              </Typography>
                            </Box>
                          )}
                          
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              <strong>Timestamp:</strong> {new Date(log.timestamp).toLocaleString()}
                            </Typography>
                          </Box>
                          
                          {log.metadata && (
                            <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                              <Typography variant="caption" color="text.secondary">
                                <strong>Metadata:</strong>
                              </Typography>
                              <Paper sx={{ p: 1, mt: 0.5, backgroundColor: 'grey.100' }}>
                                <Typography 
                                  variant="caption" 
                                  component="pre"
                                  sx={{ 
                                    fontSize: '0.7rem',
                                    overflow: 'auto',
                                    maxHeight: 200
                                  }}
                                >
                                  {JSON.stringify(log.metadata, null, 2)}
                                </Typography>
                              </Paper>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </Collapse>
                  </Box>
                </ListItem>
                {index < filteredLogs.length - 1 && <Divider variant="middle" />}
              </React.Fragment>
            );
          })}
        </List>

        {/* Empty State */}
        {filteredLogs.length === 0 && !loading && (
          <Box 
            display="flex" 
            flexDirection="column" 
            alignItems="center" 
            justifyContent="center"
            sx={{ height: 200 }}
          >
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No logs found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try adjusting your filters or check back later
            </Typography>
          </Box>
        )}
      </Box>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, newPage) => setPage(newPage)}
            color="primary"
          />
        </Box>
      )}
    </Card>
  );
};