// Comprehensive Insulin Pump Configuration for AAPS Integration
// Based on AndroidAPS supported insulin pumps

export type TherapyAlgorithm = 'aaps' | 'loop';
export type CompatibilityLevel = 'supported' | 'experimental' | 'not-supported';

export interface PumpPlatformCompatibility {
  aaps: CompatibilityLevel;
  loop: CompatibilityLevel;
  tidepoolLoop: CompatibilityLevel;
  notes: string[];
  sources: string[];
}

export interface InsulinPumpProfile {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  category: 'tubeless' | 'tubed' | 'diy';
  
  // Physical constraints
  basalIncrements: number;
  bolusIncrements: number;
  maxBasalRate: number;
  maxBolus: number;
  reservoirCapacity: number;
  
  // Safety features
  hasOcclusion: boolean;
  hasLowReservoir: boolean;
  hasBatteryMonitoring: boolean;
  hasTempBasal: boolean;
  maxTempBasalDuration: number; // minutes
  maxTempBasalRate: number;
  
  // AAPS Integration
  aapsSupported: boolean;
  aapsDriverName: string;
  communicationType: 'bluetooth' | 'rileylink' | 'orangelink' | 'medtrum' | 'dash' | 'usb';
  
  // Insulin delivery characteristics
  deliveryDelay: number; // seconds - time between command and delivery
  cannulaChangeInterval: number; // hours - recommended cannula change frequency
  reservoirChangeInterval: number; // hours - recommended reservoir change frequency
  
  // OpenAPS/AAPS specific settings
  recommendedMaxIOB: number;
  recommendedMaxTempBasal: number;
  recommendedDynamicISF: number;
  safetyMultiplier: number; // multiplier for conservative settings
  
  // Pump-specific features
  features: string[];
  limitations: string[];
  
  // Cost and availability
  approximateCost: string;
  availability: 'worldwide' | 'us-only' | 'eu-only' | 'limited';
}

const DEFAULT_COMPATIBILITY: PumpPlatformCompatibility = {
  aaps: 'not-supported',
  loop: 'not-supported',
  tidepoolLoop: 'not-supported',
  notes: [],
  sources: []
};

// Complete AAPS-supported insulin pump database
export const INSULIN_PUMPS: Record<string, InsulinPumpProfile> = {
  // === OMNIPOD PUMPS ===
  'omnipod-dash': {
    id: 'omnipod-dash',
    name: 'Omnipod DASH',
    manufacturer: 'Insulet',
    model: 'DASH',
    category: 'tubeless',
    
    basalIncrements: 0.05,
    bolusIncrements: 0.05,
    maxBasalRate: 30.0,
    maxBolus: 30.0,
    reservoirCapacity: 200,
    
    hasOcclusion: true,
    hasLowReservoir: true,
    hasBatteryMonitoring: false, // Pod is disposable
    hasTempBasal: true,
    maxTempBasalDuration: 720, // 12 hours
    maxTempBasalRate: 30.0,
    
    aapsSupported: true,
    aapsDriverName: 'Omnipod DASH',
    communicationType: 'bluetooth',
    
    deliveryDelay: 60,
    cannulaChangeInterval: 72,
    reservoirChangeInterval: 72, // Pod change
    
    recommendedMaxIOB: 5.0,
    recommendedMaxTempBasal: 6.0,
    recommendedDynamicISF: 100,
    safetyMultiplier: 1.0,
    
    features: [
      'Tubeless design',
      'Bluetooth connectivity',
      'No battery maintenance',
      'Waterproof pod',
      'Automatic insertion',
      'Personal Diabetes Manager (PDM)'
    ],
    limitations: [
      '3-day pod life',
      'Proprietary cannula',
      'Limited to 0.05U increments',
      'Pod disposal required'
    ],
    
    approximateCost: '$300-400/month',
    availability: 'worldwide'
  },

  'omnipod-eros': {
    id: 'omnipod-eros',
    name: 'Omnipod Eros',
    manufacturer: 'Insulet',
    model: 'Eros',
    category: 'tubeless',
    
    basalIncrements: 0.05,
    bolusIncrements: 0.05,
    maxBasalRate: 30.0,
    maxBolus: 30.0,
    reservoirCapacity: 200,
    
    hasOcclusion: true,
    hasLowReservoir: true,
    hasBatteryMonitoring: false,
    hasTempBasal: true,
    maxTempBasalDuration: 720,
    maxTempBasalRate: 30.0,
    
    aapsSupported: true,
    aapsDriverName: 'Omnipod Eros',
    communicationType: 'rileylink',
    
    deliveryDelay: 60,
    cannulaChangeInterval: 72,
    reservoirChangeInterval: 72,
    
    recommendedMaxIOB: 5.0,
    recommendedMaxTempBasal: 6.0,
    recommendedDynamicISF: 100,
    safetyMultiplier: 1.0,
    
    features: [
      'Tubeless design',
      'RileyLink compatible',
      'No battery maintenance',
      'Waterproof pod',
      'Automatic insertion'
    ],
    limitations: [
      '3-day pod life',
      'Requires RileyLink for AAPS',
      'Limited to 0.05U increments',
      'Pod disposal required'
    ],
    
    approximateCost: '$300-400/month',
    availability: 'worldwide'
  },

  // === MEDTRONIC PUMPS ===
  'medtronic-670g': {
    id: 'medtronic-670g',
    name: 'MiniMed 670G',
    manufacturer: 'Medtronic',
    model: '670G',
    category: 'tubed',
    
    basalIncrements: 0.025,
    bolusIncrements: 0.1,
    maxBasalRate: 35.0,
    maxBolus: 25.0,
    reservoirCapacity: 300,
    
    hasOcclusion: true,
    hasLowReservoir: true,
    hasBatteryMonitoring: true,
    hasTempBasal: true,
    maxTempBasalDuration: 24 * 60,
    maxTempBasalRate: 35.0,
    
    aapsSupported: true,
    aapsDriverName: 'Medtronic 600 Series',
    communicationType: 'rileylink',
    
    deliveryDelay: 40,
    cannulaChangeInterval: 72,
    reservoirChangeInterval: 72,
    
    recommendedMaxIOB: 6.0,
    recommendedMaxTempBasal: 8.0,
    recommendedDynamicISF: 95,
    safetyMultiplier: 0.9,
    
    features: [
      'SmartGuard technology',
      'Integrated CGM',
      'Auto-suspend',
      'Color display',
      'MiniMed Mobile app',
      'CareLink connectivity'
    ],
    limitations: [
      'Requires specific CGM',
      'Complex menu system',
      'Requires RileyLink for AAPS',
      'Limited customization in Auto Mode'
    ],
    
    approximateCost: '$200-300/month',
    availability: 'worldwide'
  },

  'medtronic-780g': {
    id: 'medtronic-780g',
    name: 'MiniMed 780G',
    manufacturer: 'Medtronic',
    model: '780G',
    category: 'tubed',
    
    basalIncrements: 0.025,
    bolusIncrements: 0.1,
    maxBasalRate: 35.0,
    maxBolus: 25.0,
    reservoirCapacity: 300,
    
    hasOcclusion: true,
    hasLowReservoir: true,
    hasBatteryMonitoring: true,
    hasTempBasal: true,
    maxTempBasalDuration: 24 * 60,
    maxTempBasalRate: 35.0,
    
    aapsSupported: true,
    aapsDriverName: 'Medtronic 600 Series',
    communicationType: 'rileylink',
    
    deliveryDelay: 40,
    cannulaChangeInterval: 72,
    reservoirChangeInterval: 72,
    
    recommendedMaxIOB: 6.5,
    recommendedMaxTempBasal: 8.5,
    recommendedDynamicISF: 90,
    safetyMultiplier: 0.9,
    
    features: [
      'Advanced SmartGuard',
      'Meal detection',
      'Bluetooth connectivity',
      'MiniMed Mobile app',
      'Customizable targets',
      'Auto-correction boluses'
    ],
    limitations: [
      'Requires Guardian 4 sensor',
      'Complex setup',
      'Requires RileyLink for AAPS',
      'Limited meal announcement window'
    ],
    
    approximateCost: '$250-350/month',
    availability: 'limited'
  },

  // === TANDEM PUMPS ===
  'tandem-t-slim-x2': {
    id: 'tandem-t-slim-x2',
    name: 't:slim X2',
    manufacturer: 'Tandem',
    model: 't:slim X2',
    category: 'tubed',
    
    basalIncrements: 0.001,
    bolusIncrements: 0.01,
    maxBasalRate: 15.0,
    maxBolus: 25.0,
    reservoirCapacity: 300,
    
    hasOcclusion: true,
    hasLowReservoir: true,
    hasBatteryMonitoring: true,
    hasTempBasal: true,
    maxTempBasalDuration: 24 * 60,
    maxTempBasalRate: 15.0,
    
    aapsSupported: false, // No direct AAPS support yet
    aapsDriverName: 'Not supported',
    communicationType: 'bluetooth',
    
    deliveryDelay: 30,
    cannulaChangeInterval: 72,
    reservoirChangeInterval: 72,
    
    recommendedMaxIOB: 5.5,
    recommendedMaxTempBasal: 7.0,
    recommendedDynamicISF: 95,
    safetyMultiplier: 1.0,
    
    features: [
      'Touch screen interface',
      'Control-IQ algorithm',
      'Dexcom G6/G7 integration',
      'Mobile bolus',
      'Sleep activity',
      'Exercise activity'
    ],
    limitations: [
      'No AAPS support currently',
      'Proprietary algorithm only',
      'Requires Dexcom CGM for Control-IQ',
      'Touch screen can be sensitive'
    ],
    
    approximateCost: '$200-300/month',
    availability: 'us-only'
  },

  // === ACCU-CHEK PUMPS ===
  'accu-chek-combo': {
    id: 'accu-chek-combo',
    name: 'Accu-Chek Combo',
    manufacturer: 'Roche',
    model: 'Combo',
    category: 'tubed',
    
    basalIncrements: 0.01,
    bolusIncrements: 0.1,
    maxBasalRate: 40.0,
    maxBolus: 50.0,
    reservoirCapacity: 315,
    
    hasOcclusion: true,
    hasLowReservoir: true,
    hasBatteryMonitoring: true,
    hasTempBasal: true,
    maxTempBasalDuration: 24 * 60,
    maxTempBasalRate: 40.0,
    
    aapsSupported: true,
    aapsDriverName: 'Accu-Chek Combo',
    communicationType: 'bluetooth',
    
    deliveryDelay: 45,
    cannulaChangeInterval: 72,
    reservoirChangeInterval: 72,
    
    recommendedMaxIOB: 7.0,
    recommendedMaxTempBasal: 10.0,
    recommendedDynamicISF: 90,
    safetyMultiplier: 0.85,
    
    features: [
      'Bluetooth connectivity',
      'Large insulin capacity',
      'Remote bolus',
      'High basal rates',
      'Proven reliability',
      'European standard'
    ],
    limitations: [
      'Older interface',
      'Limited in some regions',
      'Bluetooth connectivity issues',
      'Complex setup'
    ],
    
    approximateCost: '$150-250/month',
    availability: 'eu-only'
  },

  'accu-chek-insight': {
    id: 'accu-chek-insight',
    name: 'Accu-Chek Insight',
    manufacturer: 'Roche',
    model: 'Insight',
    category: 'tubed',
    
    basalIncrements: 0.01,
    bolusIncrements: 0.01,
    maxBasalRate: 25.0,
    maxBolus: 25.0,
    reservoirCapacity: 160,
    
    hasOcclusion: true,
    hasLowReservoir: true,
    hasBatteryMonitoring: true,
    hasTempBasal: true,
    maxTempBasalDuration: 24 * 60,
    maxTempBasalRate: 25.0,
    
    aapsSupported: true,
    aapsDriverName: 'Accu-Chek Insight',
    communicationType: 'bluetooth',
    
    deliveryDelay: 35,
    cannulaChangeInterval: 72,
    reservoirChangeInterval: 72,
    
    recommendedMaxIOB: 5.5,
    recommendedMaxTempBasal: 7.5,
    recommendedDynamicISF: 95,
    safetyMultiplier: 0.9,
    
    features: [
      'Bluetooth connectivity',
      'Modern interface',
      'Quick setup',
      'Precise delivery',
      'Good AAPS integration',
      'Compact design'
    ],
    limitations: [
      'Smaller reservoir',
      'Limited availability',
      'Proprietary supplies',
      'Higher cost per unit'
    ],
    
    approximateCost: '$200-300/month',
    availability: 'eu-only'
  },

  // === DANA PUMPS ===
  'dana-r': {
    id: 'dana-r',
    name: 'DanaR',
    manufacturer: 'SOOIL',
    model: 'DanaR',
    category: 'tubed',
    
    basalIncrements: 0.01,
    bolusIncrements: 0.01,
    maxBasalRate: 35.0,
    maxBolus: 35.0,
    reservoirCapacity: 300,
    
    hasOcclusion: true,
    hasLowReservoir: true,
    hasBatteryMonitoring: true,
    hasTempBasal: true,
    maxTempBasalDuration: 24 * 60,
    maxTempBasalRate: 35.0,
    
    aapsSupported: true,
    aapsDriverName: 'DanaR',
    communicationType: 'bluetooth',
    
    deliveryDelay: 30,
    cannulaChangeInterval: 72,
    reservoirChangeInterval: 72,
    
    recommendedMaxIOB: 6.0,
    recommendedMaxTempBasal: 8.0,
    recommendedDynamicISF: 95,
    safetyMultiplier: 0.9,
    
    features: [
      'Excellent AAPS integration',
      'Bluetooth connectivity',
      'Cost effective',
      'Reliable delivery',
      'Simple interface',
      'Good battery life'
    ],
    limitations: [
      'Basic display',
      'Limited availability',
      'Manual priming required',
      'Korean language default'
    ],
    
    approximateCost: '$100-200/month',
    availability: 'limited'
  },

  'dana-rs': {
    id: 'dana-rs',
    name: 'DanaRS',
    manufacturer: 'SOOIL',
    model: 'DanaRS',
    category: 'tubed',
    
    basalIncrements: 0.01,
    bolusIncrements: 0.01,
    maxBasalRate: 35.0,
    maxBolus: 35.0,
    reservoirCapacity: 300,
    
    hasOcclusion: true,
    hasLowReservoir: true,
    hasBatteryMonitoring: true,
    hasTempBasal: true,
    maxTempBasalDuration: 24 * 60,
    maxTempBasalRate: 35.0,
    
    aapsSupported: true,
    aapsDriverName: 'DanaRS',
    communicationType: 'bluetooth',
    
    deliveryDelay: 30,
    cannulaChangeInterval: 72,
    reservoirChangeInterval: 72,
    
    recommendedMaxIOB: 6.5,
    recommendedMaxTempBasal: 8.5,
    recommendedDynamicISF: 90,
    safetyMultiplier: 0.85,
    
    features: [
      'Enhanced AAPS integration',
      'Improved Bluetooth',
      'Color display',
      'Better interface',
      'Dual battery system',
      'Multiple language support'
    ],
    limitations: [
      'Higher cost than DanaR',
      'Limited availability',
      'Complex setup initially',
      'Requires specific batteries'
    ],
    
    approximateCost: '$150-250/month',
    availability: 'limited'
  },

  'dana-i': {
    id: 'dana-i',
    name: 'Dana-i',
    manufacturer: 'SOOIL',
    model: 'Dana-i',
    category: 'tubed',
    
    basalIncrements: 0.01,
    bolusIncrements: 0.01,
    maxBasalRate: 35.0,
    maxBolus: 35.0,
    reservoirCapacity: 300,
    
    hasOcclusion: true,
    hasLowReservoir: true,
    hasBatteryMonitoring: true,
    hasTempBasal: true,
    maxTempBasalDuration: 24 * 60,
    maxTempBasalRate: 35.0,
    
    aapsSupported: true,
    aapsDriverName: 'Dana-i',
    communicationType: 'bluetooth',
    
    deliveryDelay: 25,
    cannulaChangeInterval: 72,
    reservoirChangeInterval: 72,
    
    recommendedMaxIOB: 7.0,
    recommendedMaxTempBasal: 9.0,
    recommendedDynamicISF: 85,
    safetyMultiplier: 0.8,
    
    features: [
      'Latest Dana technology',
      'Excellent AAPS integration',
      'Fast delivery',
      'Modern interface',
      'WiFi connectivity',
      'Advanced safety features'
    ],
    limitations: [
      'Newest model - limited data',
      'Higher cost',
      'May have initial software issues',
      'Limited availability'
    ],
    
    approximateCost: '$200-300/month',
    availability: 'limited'
  },

  'diaconn-g8': {
    id: 'diaconn-g8',
    name: 'Diaconn G8',
    manufacturer: 'Diaconn',
    model: 'G8',
    category: 'tubed',

    basalIncrements: 0.01,
    bolusIncrements: 0.01,
    maxBasalRate: 30.0,
    maxBolus: 30.0,
    reservoirCapacity: 300,

    hasOcclusion: true,
    hasLowReservoir: true,
    hasBatteryMonitoring: true,
    hasTempBasal: true,
    maxTempBasalDuration: 24 * 60,
    maxTempBasalRate: 30.0,

    aapsSupported: true,
    aapsDriverName: 'Diaconn G8',
    communicationType: 'bluetooth',

    deliveryDelay: 35,
    cannulaChangeInterval: 72,
    reservoirChangeInterval: 72,

    recommendedMaxIOB: 6.0,
    recommendedMaxTempBasal: 8.0,
    recommendedDynamicISF: 95,
    safetyMultiplier: 0.9,

    features: [
      'AAPS compatible driver',
      'Bluetooth communication',
      'High precision delivery',
      'Large reservoir'
    ],
    limitations: [
      'Region-limited availability',
      'Smaller user base than Dana/Omnipod'
    ],

    approximateCost: '$180-280/month',
    availability: 'limited'
  },

  'medtronic-legacy': {
    id: 'medtronic-legacy',
    name: 'Medtronic Legacy (x15/x22/x23/x54)',
    manufacturer: 'Medtronic',
    model: '515/715, 522/722, 523/723, 554/754',
    category: 'diy',

    basalIncrements: 0.025,
    bolusIncrements: 0.05,
    maxBasalRate: 35.0,
    maxBolus: 25.0,
    reservoirCapacity: 300,

    hasOcclusion: true,
    hasLowReservoir: true,
    hasBatteryMonitoring: true,
    hasTempBasal: true,
    maxTempBasalDuration: 24 * 60,
    maxTempBasalRate: 35.0,

    aapsSupported: true,
    aapsDriverName: 'Medtronic (older models)',
    communicationType: 'rileylink',

    deliveryDelay: 50,
    cannulaChangeInterval: 72,
    reservoirChangeInterval: 72,

    recommendedMaxIOB: 6.0,
    recommendedMaxTempBasal: 8.0,
    recommendedDynamicISF: 95,
    safetyMultiplier: 0.9,

    features: [
      'Supported in AAPS and Loop with compatible bridge device',
      'Large community documentation',
      'Firmware-dependent compatibility'
    ],
    limitations: [
      'Older hardware only',
      'Requires bridge device (RileyLink/OrangeLink class)',
      'Model and firmware must be validated before use'
    ],

    approximateCost: 'Used/secondary-market',
    availability: 'limited'
  },

  // === MEDTRUM PUMPS ===
  'medtrum-nano': {
    id: 'medtrum-nano',
    name: 'TouchCare Nano',
    manufacturer: 'Medtrum',
    model: 'Nano',
    category: 'tubeless',
    
    basalIncrements: 0.05,
    bolusIncrements: 0.05,
    maxBasalRate: 25.0,
    maxBolus: 25.0,
    reservoirCapacity: 200,
    
    hasOcclusion: true,
    hasLowReservoir: true,
    hasBatteryMonitoring: false,
    hasTempBasal: true,
    maxTempBasalDuration: 720,
    maxTempBasalRate: 25.0,
    
    aapsSupported: true,
    aapsDriverName: 'Medtrum',
    communicationType: 'medtrum',
    
    deliveryDelay: 50,
    cannulaChangeInterval: 72,
    reservoirChangeInterval: 72,
    
    recommendedMaxIOB: 5.0,
    recommendedMaxTempBasal: 6.0,
    recommendedDynamicISF: 100,
    safetyMultiplier: 1.0,
    
    features: [
      'Tubeless design',
      'Proprietary connectivity',
      'Affordable option',
      'Simple interface',
      'Disposable pods',
      'AAPS support'
    ],
    limitations: [
      '3-day pod life',
      'Newer technology',
      'Limited availability',
      'Proprietary supplies'
    ],
    
    approximateCost: '$200-300/month',
    availability: 'limited'
  },

  'medtrum-300u': {
    id: 'medtrum-300u',
    name: 'Medtrum 300U',
    manufacturer: 'Medtrum',
    model: '300U patch',
    category: 'tubeless',

    basalIncrements: 0.05,
    bolusIncrements: 0.05,
    maxBasalRate: 25.0,
    maxBolus: 25.0,
    reservoirCapacity: 300,

    hasOcclusion: true,
    hasLowReservoir: true,
    hasBatteryMonitoring: false,
    hasTempBasal: true,
    maxTempBasalDuration: 720,
    maxTempBasalRate: 25.0,

    aapsSupported: true,
    aapsDriverName: 'Medtrum',
    communicationType: 'medtrum',

    deliveryDelay: 50,
    cannulaChangeInterval: 72,
    reservoirChangeInterval: 72,

    recommendedMaxIOB: 5.5,
    recommendedMaxTempBasal: 6.5,
    recommendedDynamicISF: 98,
    safetyMultiplier: 1.0,

    features: [
      'Tubeless 300U patch option',
      'AAPS compatible',
      'Loop experimental branch support'
    ],
    limitations: [
      'Branch-specific support for Loop',
      'Region-limited availability'
    ],

    approximateCost: '$220-320/month',
    availability: 'limited'
  },

  'equil-5-3': {
    id: 'equil-5-3',
    name: 'Equil 5.3',
    manufacturer: 'MicroTech',
    model: 'Equil 5.3',
    category: 'tubeless',

    basalIncrements: 0.05,
    bolusIncrements: 0.05,
    maxBasalRate: 25.0,
    maxBolus: 25.0,
    reservoirCapacity: 200,

    hasOcclusion: true,
    hasLowReservoir: true,
    hasBatteryMonitoring: false,
    hasTempBasal: true,
    maxTempBasalDuration: 720,
    maxTempBasalRate: 25.0,

    aapsSupported: true,
    aapsDriverName: 'Equil 5.3',
    communicationType: 'bluetooth',

    deliveryDelay: 50,
    cannulaChangeInterval: 72,
    reservoirChangeInterval: 72,

    recommendedMaxIOB: 5.0,
    recommendedMaxTempBasal: 6.0,
    recommendedDynamicISF: 100,
    safetyMultiplier: 1.0,

    features: [
      'Patch-style pump',
      'Bluetooth communication',
      'AAPS compatible'
    ],
    limitations: [
      'Not listed in LoopDocs compatibility',
      'Region-limited availability'
    ],

    approximateCost: '$180-280/month',
    availability: 'limited'
  },

  // === DIY/RESEARCH PUMPS ===
  'eopatch': {
    id: 'eopatch',
    name: 'EOPatch',
    manufacturer: 'EOFlow',
    model: 'EOPatch',
    category: 'tubeless',
    
    basalIncrements: 0.05,
    bolusIncrements: 0.05,
    maxBasalRate: 36.0,
    maxBolus: 25.0,
    reservoirCapacity: 84,
    
    hasOcclusion: true,
    hasLowReservoir: true,
    hasBatteryMonitoring: false,
    hasTempBasal: true,
    maxTempBasalDuration: 720,
    maxTempBasalRate: 36.0,
    
    aapsSupported: true,
    aapsDriverName: 'EOPatch',
    communicationType: 'bluetooth',
    
    deliveryDelay: 40,
    cannulaChangeInterval: 84, // 3.5 days
    reservoirChangeInterval: 84,
    
    recommendedMaxIOB: 4.5,
    recommendedMaxTempBasal: 5.5,
    recommendedDynamicISF: 105,
    safetyMultiplier: 1.1,
    
    features: [
      'Tubeless patch design',
      'Ultra-thin profile',
      'Bluetooth connectivity',
      'Extended wear time',
      'Waterproof',
      'Silent operation'
    ],
    limitations: [
      'Small reservoir',
      'Limited availability',
      'Newer technology',
      'Higher per-unit cost'
    ],
    
    approximateCost: '$250-350/month',
    availability: 'limited'
  },

  'diy-loop': {
    id: 'diy-loop',
    name: 'DIY Loop Compatible',
    manufacturer: 'Various',
    model: 'Multiple',
    category: 'diy',
    
    basalIncrements: 0.025, // Conservative estimate
    bolusIncrements: 0.05,
    maxBasalRate: 30.0,
    maxBolus: 25.0,
    reservoirCapacity: 300,
    
    hasOcclusion: true,
    hasLowReservoir: true,
    hasBatteryMonitoring: true,
    hasTempBasal: true,
    maxTempBasalDuration: 24 * 60,
    maxTempBasalRate: 30.0,
    
    aapsSupported: false,
    aapsDriverName: 'N/A - iOS Loop',
    communicationType: 'rileylink',
    
    deliveryDelay: 45,
    cannulaChangeInterval: 72,
    reservoirChangeInterval: 72,
    
    recommendedMaxIOB: 6.0,
    recommendedMaxTempBasal: 8.0,
    recommendedDynamicISF: 100,
    safetyMultiplier: 0.9,
    
    features: [
      'iOS Loop compatibility',
      'Multiple pump options',
      'Open source',
      'Customizable algorithms',
      'Community support',
      'Research-grade features'
    ],
    limitations: [
      'DIY setup required',
      'No official support',
      'Requires technical knowledge',
      'iOS only',
      'RileyLink dependency'
    ],
    
    approximateCost: '$150-400/month',
    availability: 'worldwide'
  }
};

// Compatibility model sourced from official docs pages.
export const PUMP_PLATFORM_COMPATIBILITY: Record<string, PumpPlatformCompatibility> = {
  'omnipod-dash': {
    aaps: 'supported',
    loop: 'supported',
    tidepoolLoop: 'supported',
    notes: [
      'AAPS supports Omnipod DASH over native Bluetooth.',
      'Loop on iOS supports Omnipod DASH without RileyLink.',
      'Tidepool Loop ecosystem is commercially deployed as twiist Loop; availability is region and partner dependent.'
    ],
    sources: [
      'https://androidaps.readthedocs.io/en/latest/Getting-Started/CompatiblePumps.html',
      'https://loopkit.github.io/loopdocs/build/pump/',
      'https://www.tidepool.org/tidepool-loop'
    ]
  },
  'omnipod-eros': {
    aaps: 'supported',
    loop: 'supported',
    tidepoolLoop: 'not-supported',
    notes: [
      'AAPS supports Omnipod Eros with a compatible bridge device.',
      'Loop supports Omnipod Eros; bridge hardware is required for command transport.',
      'Tidepool Loop focuses on regulated commercial pathways and does not publish Eros support as a current option.'
    ],
    sources: [
      'https://androidaps.readthedocs.io/en/latest/Getting-Started/CompatiblePumps.html',
      'https://loopkit.github.io/loopdocs/build/pump/',
      'https://www.tidepool.org/loop-device-partners'
    ]
  },
  'medtronic-670g': {
    aaps: 'not-supported',
    loop: 'not-supported',
    tidepoolLoop: 'not-supported',
    notes: [
      'AAPS documentation explicitly references certain older Medtronic models, not 670G.',
      'Loop documentation targets older Medtronic x15/x22/x23/x54 firmware-limited pumps, not 670G as a direct Loop pump.'
    ],
    sources: [
      'https://androidaps.readthedocs.io/en/latest/Getting-Started/CompatiblePumps.html',
      'https://loopkit.github.io/loopdocs/build/pump/'
    ]
  },
  'medtronic-780g': {
    aaps: 'not-supported',
    loop: 'not-supported',
    tidepoolLoop: 'not-supported',
    notes: [
      'AAPS docs describe support centered around older Medtronic compatibility families, not 780G.',
      'Loop iOS docs do not list 780G as compatible.'
    ],
    sources: [
      'https://androidaps.readthedocs.io/en/latest/Getting-Started/CompatiblePumps.html',
      'https://loopkit.github.io/loopdocs/build/pump/'
    ]
  },
  'tandem-t-slim-x2': {
    aaps: 'not-supported',
    loop: 'not-supported',
    tidepoolLoop: 'not-supported',
    notes: [
      'Not listed as a current AAPS compatible pump in the official compatibility page.',
      'Not listed as a current Loop compatible pump in LoopDocs.'
    ],
    sources: [
      'https://androidaps.readthedocs.io/en/latest/Getting-Started/CompatiblePumps.html',
      'https://loopkit.github.io/loopdocs/build/pump/'
    ]
  },
  'accu-chek-combo': {
    aaps: 'supported',
    loop: 'not-supported',
    tidepoolLoop: 'not-supported',
    notes: [
      'AAPS lists Accu-Chek Combo as supported over Bluetooth.',
      'Loop does not list Accu-Chek Combo as compatible.'
    ],
    sources: [
      'https://androidaps.readthedocs.io/en/latest/Getting-Started/CompatiblePumps.html',
      'https://loopkit.github.io/loopdocs/build/pump/'
    ]
  },
  'accu-chek-insight': {
    aaps: 'supported',
    loop: 'not-supported',
    tidepoolLoop: 'not-supported',
    notes: [
      'AAPS lists Accu-Chek Insight as supported over Bluetooth.',
      'Loop does not list Accu-Chek Insight as compatible.'
    ],
    sources: [
      'https://androidaps.readthedocs.io/en/latest/Getting-Started/CompatiblePumps.html',
      'https://loopkit.github.io/loopdocs/build/pump/'
    ]
  },
  'dana-r': {
    aaps: 'supported',
    loop: 'not-supported',
    tidepoolLoop: 'not-supported',
    notes: [
      'DanaR is listed in AAPS compatible pumps.',
      'LoopDocs only lists Dana-i and DanaRS-v3 in the experimental development branch path.'
    ],
    sources: [
      'https://androidaps.readthedocs.io/en/latest/Getting-Started/CompatiblePumps.html',
      'https://loopkit.github.io/loopdocs/build/pump/'
    ]
  },
  'dana-rs': {
    aaps: 'supported',
    loop: 'experimental',
    tidepoolLoop: 'not-supported',
    notes: [
      'DanaRS is listed in AAPS compatible pumps.',
      'Loop supports DanaRS-v3 in an experimental development branch.'
    ],
    sources: [
      'https://androidaps.readthedocs.io/en/latest/Getting-Started/CompatiblePumps.html',
      'https://loopkit.github.io/loopdocs/build/pump/'
    ]
  },
  'dana-i': {
    aaps: 'supported',
    loop: 'experimental',
    tidepoolLoop: 'not-supported',
    notes: [
      'Dana-i is listed in AAPS compatible pumps.',
      'Loop supports Dana-i in an experimental development branch.'
    ],
    sources: [
      'https://androidaps.readthedocs.io/en/latest/Getting-Started/CompatiblePumps.html',
      'https://loopkit.github.io/loopdocs/build/pump/'
    ]
  },
  'medtrum-nano': {
    aaps: 'supported',
    loop: 'experimental',
    tidepoolLoop: 'not-supported',
    notes: [
      'AAPS lists Medtrum Nano and 300U support.',
      'Loop supports Medtrum Nano in an experimental development branch.'
    ],
    sources: [
      'https://androidaps.readthedocs.io/en/latest/Getting-Started/CompatiblePumps.html',
      'https://loopkit.github.io/loopdocs/build/pump/'
    ]
  },
  'medtrum-300u': {
    aaps: 'supported',
    loop: 'experimental',
    tidepoolLoop: 'not-supported',
    notes: [
      'AAPS lists Medtrum 300U support.',
      'LoopDocs Medtrum section indicates 300U support in the experimental Dana/Medtrum branch path.'
    ],
    sources: [
      'https://androidaps.readthedocs.io/en/latest/Getting-Started/CompatiblePumps.html',
      'https://loopkit.github.io/loopdocs/build/pump/'
    ]
  },
  'diaconn-g8': {
    aaps: 'supported',
    loop: 'not-supported',
    tidepoolLoop: 'not-supported',
    notes: [
      'AAPS lists Diaconn G8 as a compatible pump.',
      'LoopDocs does not list Diaconn G8 support.'
    ],
    sources: [
      'https://androidaps.readthedocs.io/en/latest/Getting-Started/CompatiblePumps.html',
      'https://loopkit.github.io/loopdocs/build/pump/'
    ]
  },
  'equil-5-3': {
    aaps: 'supported',
    loop: 'not-supported',
    tidepoolLoop: 'not-supported',
    notes: [
      'AAPS lists Equil 5.3 as compatible.',
      'LoopDocs does not list Equil support.'
    ],
    sources: [
      'https://androidaps.readthedocs.io/en/latest/Getting-Started/CompatiblePumps.html',
      'https://loopkit.github.io/loopdocs/build/pump/'
    ]
  },
  'medtronic-legacy': {
    aaps: 'supported',
    loop: 'supported',
    tidepoolLoop: 'not-supported',
    notes: [
      'AAPS supports certain older Medtronic pumps via additional communication hardware.',
      'Loop supports older Medtronic pump families with firmware limits.'
    ],
    sources: [
      'https://androidaps.readthedocs.io/en/latest/Getting-Started/CompatiblePumps.html',
      'https://loopkit.github.io/loopdocs/build/pump/'
    ]
  },
  eopatch: {
    aaps: 'supported',
    loop: 'not-supported',
    tidepoolLoop: 'not-supported',
    notes: [
      'AAPS lists EOPatch2 support.',
      'LoopDocs does not list EOPatch as a compatible Loop pump at this time.'
    ],
    sources: [
      'https://androidaps.readthedocs.io/en/latest/Getting-Started/CompatiblePumps.html',
      'https://loopkit.github.io/loopdocs/build/pump/'
    ]
  },
  'diy-loop': {
    aaps: 'not-supported',
    loop: 'supported',
    tidepoolLoop: 'not-supported',
    notes: [
      'Represents a generic Loop-compatible setup profile, not a single pump model.',
      'Use a specific pump option when possible for better recommendation precision.'
    ],
    sources: [
      'https://loopkit.github.io/loopdocs/build/pump/'
    ]
  }
};

// Helper functions for pump operations
export const getPumpById = (pumpId: string): InsulinPumpProfile | null => {
  return INSULIN_PUMPS[pumpId] || null;
};

export const getPumpsByCategory = (category: 'tubeless' | 'tubed' | 'diy'): InsulinPumpProfile[] => {
  return Object.values(INSULIN_PUMPS).filter(pump => pump.category === category);
};

export const getPumpPlatformCompatibility = (pumpId: string): PumpPlatformCompatibility => {
  return PUMP_PLATFORM_COMPATIBILITY[pumpId] || DEFAULT_COMPATIBILITY;
};

export const getPumpsByTherapyAlgorithm = (algorithm: TherapyAlgorithm): InsulinPumpProfile[] => {
  return Object.values(INSULIN_PUMPS).filter((pump) => {
    const compatibility = getPumpPlatformCompatibility(pump.id);
    return compatibility[algorithm] !== 'not-supported';
  });
};

export const isPumpCompatibleWithTherapyAlgorithm = (pumpId: string, algorithm: TherapyAlgorithm): boolean => {
  return getPumpPlatformCompatibility(pumpId)[algorithm] !== 'not-supported';
};

export const getAAPSSupportedPumps = (): InsulinPumpProfile[] => {
  return Object.values(INSULIN_PUMPS).filter(pump => pump.aapsSupported);
};

export const getPumpsByAvailability = (availability: 'worldwide' | 'us-only' | 'eu-only' | 'limited'): InsulinPumpProfile[] => {
  return Object.values(INSULIN_PUMPS).filter(pump => pump.availability === availability);
};

// Pump-specific calculation helpers
export const roundToBasalIncrement = (rate: number, pumpId: string): number => {
  const pump = getPumpById(pumpId);
  if (!pump) return Math.round(rate * 20) / 20; // Default 0.05 increment
  
  const increment = pump.basalIncrements;
  return Math.round(rate / increment) * increment;
};

export const roundToBolusIncrement = (bolus: number, pumpId: string): number => {
  const pump = getPumpById(pumpId);
  if (!pump) return Math.round(bolus * 20) / 20; // Default 0.05 increment
  
  const increment = pump.bolusIncrements;
  return Math.round(bolus / increment) * increment;
};

export const validateBasalRate = (rate: number, pumpId: string): { valid: boolean; maxRate: number } => {
  const pump = getPumpById(pumpId);
  if (!pump) return { valid: rate <= 30, maxRate: 30 };
  
  return {
    valid: rate <= pump.maxBasalRate,
    maxRate: pump.maxBasalRate
  };
};

export const validateBolus = (bolus: number, pumpId: string): { valid: boolean; maxBolus: number } => {
  const pump = getPumpById(pumpId);
  if (!pump) return { valid: bolus <= 25, maxBolus: 25 };
  
  return {
    valid: bolus <= pump.maxBolus,
    maxBolus: pump.maxBolus
  };
};

// Default pump (Omnipod Dash)
export const DEFAULT_PUMP_ID = 'omnipod-dash';
