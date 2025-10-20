import '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    diabetesColors: {
      glucose: {
        critical: string;
        low: string;
        target: string;
        high: string;
      };
      insulin: {
        rapid: string;
        longActing: string;
        basal: string;
      };
      carbs: {
        simple: string;
        complex: string;
        fiber: string;
      };
      activity: {
        exercise: string;
        rest: string;
        sleep: string;
      };
    };
  }

  interface PaletteOptions {
    diabetesColors?: {
      glucose?: {
        critical?: string;
        low?: string;
        target?: string;
        high?: string;
      };
      insulin?: {
        rapid?: string;
        longActing?: string;
        basal?: string;
      };
      carbs?: {
        simple?: string;
        complex?: string;
        fiber?: string;
      };
      activity?: {
        exercise?: string;
        rest?: string;
        sleep?: string;
      };
    };
  }
}
