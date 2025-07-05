import {
  Box,
  Card,
  CardContent,
  Grid,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';

import { AlertSystem } from './AlertSystem';
import { LogViewer } from './LogViewer';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`log-alert-tabpanel-${index}`}
      aria-labelledby={`log-alert-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 0 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export const LogAndAlertDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Card sx={{ width: '100%', height: '80vh' }}>
      <CardContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 2 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            Log Viewer & Alert System
          </Typography>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="log and alert tabs">
            <Tab label="System Logs" id="log-alert-tab-0" aria-controls="log-alert-tabpanel-0" />
            <Tab label="Alert System" id="log-alert-tab-1" aria-controls="log-alert-tabpanel-1" />
            <Tab label="Combined View" id="log-alert-tab-2" aria-controls="log-alert-tabpanel-2" />
          </Tabs>
        </Box>

        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <TabPanel value={activeTab} index={0}>
            <LogViewer 
              height={window.innerHeight * 0.65}
              showFilters={true}
              realTimeUpdates={true}
              maxEntries={1000}
            />
          </TabPanel>
          <TabPanel value={activeTab} index={1}>
            <AlertSystem 
              height={window.innerHeight * 0.65}
              showResolved={false}
              autoRefresh={true}
              refreshInterval={30000}
            />
          </TabPanel>
          <TabPanel value={activeTab} index={2}>
            <Grid container spacing={2} sx={{ height: '100%', p: 2 }}>
              <Grid item xs={12} md={6} sx={{ height: '100%' }}>
                <LogViewer 
                  height={window.innerHeight * 0.6}
                  showFilters={false}
                  realTimeUpdates={true}
                  maxEntries={500}
                />
              </Grid>
              <Grid item xs={12} md={6} sx={{ height: '100%' }}>
                <AlertSystem 
                  height={window.innerHeight * 0.6}
                  showResolved={false}
                  autoRefresh={true}
                  refreshInterval={15000}
                />
              </Grid>
            </Grid>
          </TabPanel>
        </Box>
      </CardContent>
    </Card>
  );
};

export default LogAndAlertDashboard;
