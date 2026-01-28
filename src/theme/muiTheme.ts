import { createTheme, ThemeOptions } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

// Define diabetes-specific color palette
const diabetesColors = {
  primary: {
    main: '#1565C0', // Medical blue
    light: '#42A5F5',
    dark: '#0D47A1',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#7B1FA2', // Medical purple
    light: '#BA68C8',
    dark: '#4A148C',
    contrastText: '#FFFFFF',
  },
  success: {
    main: '#2E7D32', // Health green
    light: '#66BB6A',
    dark: '#1B5E20',
    contrastText: '#FFFFFF',
  },
  warning: {
    main: '#F57C00', // Glucose warning
    light: '#FFB74D',
    dark: '#E65100',
    contrastText: '#FFFFFF',
  },
  error: {
    main: '#D32F2F', // Critical red
    light: '#EF5350',
    dark: '#C62828',
    contrastText: '#FFFFFF',
  },
  info: {
    main: '#0288D1', // Info blue
    light: '#29B6F6',
    dark: '#01579B',
    contrastText: '#FFFFFF',
  },
  // Custom diabetes-specific colors
  glucose: {
    low: '#E53E3E',      // Red for hypoglycemia
    target: '#38A169',   // Green for target range
    high: '#D69E2E',     // Orange for hyperglycemia
    critical: '#C53030', // Dark red for critical values
  },
  insulin: {
    main: '#553C9A',     // Purple for insulin
    light: '#805AD5',
    dark: '#44337A',
  },
  carbs: {
    main: '#DD6B20',     // Orange for carbohydrates
    light: '#F6AD55',
    dark: '#C05621',
  },
};

// Light theme configuration
const lightTheme: ThemeOptions = {
  palette: {
    mode: 'light',
    ...diabetesColors,
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A202C',
      secondary: '#4A5568',
    },
    divider: alpha('#4A5568', 0.12),
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", "Roboto", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
      background: 'linear-gradient(135deg, #1565C0 0%, #7B1FA2 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 500,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.4,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.4,
    },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    'none',
    '0px 1px 3px rgba(0, 0, 0, 0.05)',
    '0px 4px 6px rgba(0, 0, 0, 0.07)',
    '0px 5px 15px rgba(0, 0, 0, 0.08)',
    '0px 10px 24px rgba(0, 0, 0, 0.1)',
    '0px 15px 35px rgba(0, 0, 0, 0.12)',
    '0px 20px 40px rgba(0, 0, 0, 0.14)',
    '0px 25px 50px rgba(0, 0, 0, 0.16)',
    '0px 30px 60px rgba(0, 0, 0, 0.18)',
    '0px 35px 70px rgba(0, 0, 0, 0.2)',
    '0px 40px 80px rgba(0, 0, 0, 0.22)',
    '0px 45px 90px rgba(0, 0, 0, 0.24)',
    '0px 50px 100px rgba(0, 0, 0, 0.26)',
    '0px 55px 110px rgba(0, 0, 0, 0.28)',
    '0px 60px 120px rgba(0, 0, 0, 0.3)',
    '0px 65px 130px rgba(0, 0, 0, 0.32)',
    '0px 70px 140px rgba(0, 0, 0, 0.34)',
    '0px 75px 150px rgba(0, 0, 0, 0.36)',
    '0px 80px 160px rgba(0, 0, 0, 0.38)',
    '0px 85px 170px rgba(0, 0, 0, 0.4)',
    '0px 90px 180px rgba(0, 0, 0, 0.42)',
    '0px 95px 190px rgba(0, 0, 0, 0.44)',
    '0px 100px 200px rgba(0, 0, 0, 0.46)',
    '0px 105px 210px rgba(0, 0, 0, 0.48)',
    '0px 110px 220px rgba(0, 0, 0, 0.5)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        * {
          box-sizing: border-box;
        }
        body {
          background: linear-gradient(135deg, #F8FAFC 0%, #EDF2F7 100%);
          font-family: 'Inter', 'Segoe UI', 'Roboto', 'Arial', sans-serif;
        }
      `,
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(0, 0, 0, 0.06)',
          background: 'linear-gradient(145deg, #FFFFFF 0%, #F8FAFC 100%)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0px 8px 30px rgba(0, 0, 0, 0.12)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.95rem',
          padding: '10px 24px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
        contained: {
          background: 'linear-gradient(135deg, #1565C0 0%, #1976D2 100%)',
          boxShadow: '0px 4px 12px rgba(21, 101, 192, 0.3)',
          '&:hover': {
            background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 100%)',
            boxShadow: '0px 6px 20px rgba(21, 101, 192, 0.4)',
          },
        },
        outlined: {
          borderWidth: 2,
          '&:hover': {
            borderWidth: 2,
            background: alpha('#1565C0', 0.08),
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            background: '#FFFFFF',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
            },
            '&.Mui-focused': {
              boxShadow: '0px 4px 12px rgba(21, 101, 192, 0.2)',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
        filled: {
          background: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)',
          color: '#1565C0',
          '&:hover': {
            background: 'linear-gradient(135deg, #BBDEFB 0%, #90CAF9 100%)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          background: 'linear-gradient(145deg, #FFFFFF 0%, #F8FAFC 100%)',
        },
        elevation1: {
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
        },
        elevation2: {
          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
        },
        elevation3: {
          boxShadow: '0px 6px 16px rgba(0, 0, 0, 0.12)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #1565C0 0%, #7B1FA2 100%)',
          backdropFilter: 'blur(20px)',
        },
      },
    },
  },
};

// Dark theme configuration
const darkTheme: ThemeOptions = {
  palette: {
    mode: 'dark',
    ...diabetesColors,
    background: {
      default: '#0A0E1A',
      paper: '#1A1D2E',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B0BEC5',
    },
    divider: alpha('#FFFFFF', 0.12),
  },
  typography: lightTheme.typography,
  shape: lightTheme.shape,
  shadows: [
    'none',
    '0px 1px 3px rgba(0, 0, 0, 0.3)',
    '0px 4px 6px rgba(0, 0, 0, 0.4)',
    '0px 5px 15px rgba(0, 0, 0, 0.5)',
    '0px 10px 24px rgba(0, 0, 0, 0.6)',
    '0px 15px 35px rgba(0, 0, 0, 0.7)',
    '0px 20px 40px rgba(0, 0, 0, 0.8)',
    '0px 25px 50px rgba(0, 0, 0, 0.9)',
    '0px 30px 60px rgba(0, 0, 0, 1)',
    '0px 30px 60px rgba(0, 0, 0, 1)',
    '0px 30px 60px rgba(0, 0, 0, 1)',
    '0px 30px 60px rgba(0, 0, 0, 1)',
    '0px 30px 60px rgba(0, 0, 0, 1)',
    '0px 30px 60px rgba(0, 0, 0, 1)',
    '0px 30px 60px rgba(0, 0, 0, 1)',
    '0px 30px 60px rgba(0, 0, 0, 1)',
    '0px 30px 60px rgba(0, 0, 0, 1)',
    '0px 30px 60px rgba(0, 0, 0, 1)',
    '0px 30px 60px rgba(0, 0, 0, 1)',
    '0px 30px 60px rgba(0, 0, 0, 1)',
    '0px 30px 60px rgba(0, 0, 0, 1)',
    '0px 30px 60px rgba(0, 0, 0, 1)',
    '0px 30px 60px rgba(0, 0, 0, 1)',
    '0px 30px 60px rgba(0, 0, 0, 1)',
    '0px 30px 60px rgba(0, 0, 0, 1)'
  ],
  components: {
    ...lightTheme.components,
    MuiCssBaseline: {
      styleOverrides: `
        * {
          box-sizing: border-box;
        }
        body {
          background: linear-gradient(135deg, #0A0E1A 0%, #1A1D2E 100%);
          font-family: 'Inter', 'Segoe UI', 'Roboto', 'Arial', sans-serif;
        }
      `,
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'linear-gradient(145deg, #1A1D2E 0%, #16213E 100%)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0px 8px 30px rgba(0, 0, 0, 0.6)',
          },
        },
      },
    },
  },
};

// Create themes
export const lightMuiTheme = createTheme(lightTheme);
export const darkMuiTheme = createTheme(darkTheme);

// Theme provider hook
export const getMuiTheme = (isDark: boolean) => isDark ? darkMuiTheme : lightMuiTheme;

// Custom theme augmentation for diabetes-specific colors
declare module '@mui/material/styles' {
  interface Palette {
    glucose: {
      low: string;
      target: string;
      high: string;
      critical: string;
    };
    insulin: {
      main: string;
      light: string;
      dark: string;
    };
    carbs: {
      main: string;
      light: string;
      dark: string;
    };
  }

  interface PaletteOptions {
    glucose?: {
      low?: string;
      target?: string;
      high?: string;
      critical?: string;
    };
    insulin?: {
      main?: string;
      light?: string;
      dark?: string;
    };
    carbs?: {
      main?: string;
      light?: string;
      dark?: string;
    };
  }
}
