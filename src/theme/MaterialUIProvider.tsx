import React from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { useTheme } from '../contexts/ThemeContext';
import { getMuiTheme } from './muiTheme';

interface MaterialUIProviderProps {
  children: React.ReactNode;
}

export const MaterialUIProvider: React.FC<MaterialUIProviderProps> = ({ children }) => {
  const { theme } = useTheme();
  const muiTheme = getMuiTheme(theme === 'dark');

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
};
