import React, { useMemo, useCallback } from 'react';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbar,
} from '@mui/x-data-grid';
import {
  Box,
  Chip,
  Typography,
  useTheme,
  alpha,
  Avatar,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Remove,
  Bloodtype,
  LocalDining,
  Medication,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { useGlucoseFormatting } from '../../hooks/useGlucoseFormatting';

interface GlucoseReading {
  id: string;
  timestamp: Date;
  value: number;
  direction?: string;
  delta?: number;
  trend?: 'up' | 'down' | 'stable';
  type?: 'glucose' | 'meal' | 'insulin' | 'exercise';
  notes?: string;
}

interface AdvancedDataGridProps {
  data: GlucoseReading[];
  loading?: boolean;
  onRowClick?: (row: GlucoseReading) => void;
  height?: number;
  pageSize?: number;
}

export const AdvancedDataGrid: React.FC<AdvancedDataGridProps> = ({
  data,
  loading = false,
  onRowClick,
  height = 600,
  pageSize = 25,
}) => {
  const theme = useTheme();
  const { formatGlucoseValue, getCurrentGlucoseRanges } = useGlucoseFormatting();

  const getGlucoseColor = useCallback((value: number) => {
    const ranges = getCurrentGlucoseRanges();
    if (value < ranges.LOW_THRESHOLD) return theme.palette.glucose.low;
    if (value > ranges.HIGH_THRESHOLD) return theme.palette.glucose.high;
    if (value >= ranges.TARGET_MIN && value <= ranges.TARGET_MAX) return theme.palette.glucose.target;
    return theme.palette.warning.main;
  }, [getCurrentGlucoseRanges, theme]);

  const getGlucoseStatus = useCallback((value: number) => {
    const ranges = getCurrentGlucoseRanges();
    if (value < ranges.LOW_THRESHOLD) return 'Low';
    if (value > ranges.HIGH_THRESHOLD) return 'High';
    if (value >= ranges.TARGET_MIN && value <= ranges.TARGET_MAX) return 'Target';
    return 'Borderline';
  }, [getCurrentGlucoseRanges]);

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'up': return <TrendingUp fontSize="small" />;
      case 'down': return <TrendingDown fontSize="small" />;
      default: return <Remove fontSize="small" />;
    }
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'meal': return <LocalDining fontSize="small" />;
      case 'insulin': return <Medication fontSize="small" />;
      default: return <Bloodtype fontSize="small" />;
    }
  };

  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'timestamp',
      headerName: 'Time',
      width: 140,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Typography variant="body2" fontWeight={500}>
            {format(params.value, 'HH:mm')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {format(params.value, 'MMM dd')}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 80,
      renderCell: (params: GridRenderCellParams) => (
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: theme.palette.primary.main,
          }}
        >
          {getTypeIcon(params.value)}
        </Avatar>
      ),
    },
    {
      field: 'value',
      headerName: 'Glucose',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const value = params.value as number;
        const color = getGlucoseColor(value);
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="body1"
              fontWeight={600}
              sx={{ color }}
            >
              {formatGlucoseValue(value, 'mgdl', true)}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      renderCell: (params: GridRenderCellParams) => {
        const row = params.row as GlucoseReading;
        const status = getGlucoseStatus(row.value);
        const color = getGlucoseColor(row.value);
        
        return (
          <Chip
            label={status}
            size="small"
            sx={{
              bgcolor: alpha(color, 0.1),
              color: color,
              border: `1px solid ${alpha(color, 0.3)}`,
              fontWeight: 500,
            }}
          />
        );
      },
    },
    {
      field: 'trend',
      headerName: 'Trend',
      width: 100,
      renderCell: (params: GridRenderCellParams) => {
        const row = params.row as GlucoseReading;
        const trendColor = row.trend === 'up' ? theme.palette.success.main : 
                          row.trend === 'down' ? theme.palette.error.main : 
                          theme.palette.text.secondary;
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ color: trendColor }}>
              {getTrendIcon(row.trend)}
            </Box>
            {row.delta && (
              <Typography variant="caption" sx={{ color: trendColor }}>
                {row.delta > 0 ? '+' : ''}{row.delta}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: 'notes',
      headerName: 'Notes',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Typography
          variant="body2"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {params.value || '—'}
        </Typography>
      ),
    },
  ], [theme, formatGlucoseValue, getGlucoseColor, getGlucoseStatus]);

  const rows = useMemo(() => 
    data.map((reading, index) => ({
      ...reading,
      id: reading.id || index.toString(),
    }))
  , [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Box
        sx={{
          height,
          width: '100%',
          '& .MuiDataGrid-root': {
            border: 'none',
            borderRadius: 2,
            bgcolor: 'background.paper',
            boxShadow: theme.shadows[3],
          },
          '& .MuiDataGrid-columnHeaders': {
            bgcolor: alpha(theme.palette.primary.main, 0.05),
            borderBottom: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          },
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 600,
            color: theme.palette.primary.main,
          },
          '& .MuiDataGrid-row': {
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              cursor: onRowClick ? 'pointer' : 'default',
            },
            '&.Mui-selected': {
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.12),
              },
            },
          },
          '& .MuiDataGrid-cell': {
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            display: 'flex',
            alignItems: 'center',
          },
          '& .MuiDataGrid-footerContainer': {
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            bgcolor: alpha(theme.palette.primary.main, 0.02),
          },
        }}
      >
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          initialState={{
            pagination: {
              paginationModel: { pageSize },
            },
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          disableRowSelectionOnClick={!onRowClick}
          onRowClick={onRowClick ? (params) => onRowClick(params.row as GlucoseReading) : undefined}
          slots={{
            toolbar: GridToolbar,
          }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 500 },
            },
          }}
          sx={{
            '& .MuiDataGrid-toolbarContainer': {
              p: 2,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            },
          }}
        />
      </Box>
    </motion.div>
  );
};
