import axios from 'axios';
import SunCalc from 'suncalc';
import { roundToDecimal } from '../utils/mathUtils';
import { toMmol } from '../utils/glucoseUtils';
import type { NightscoutEntry } from '../types/nightscout';

interface WeatherData {
  temp: number;
  humidity: number;
  pressure: number;
  weather: string;
}

interface Location {
  latitude: number;
  longitude: number;
}

export const analyzeWeatherImpact = async (readings: NightscoutEntry[], location: Location) => {
  // Check if API key exists before attempting to fetch weather data
  if (!import.meta.env.VITE_OPENWEATHER_API_KEY) {
    console.warn('OpenWeather API key not found. Weather analysis will be skipped.');
    return null;
  }

  const weatherData = await fetchWeatherData(location);
  if (!weatherData) return null;

  const sunTimes = SunCalc.getTimes(new Date(), location.latitude, location.longitude);
  const dawnReadings = readings.filter(r => isTimeInRange(r.date, sunTimes.dawn, sunTimes.sunrise));
  const dayReadings = readings.filter(r => isTimeInRange(r.date, sunTimes.sunrise, sunTimes.sunset));
  const duskReadings = readings.filter(r => isTimeInRange(r.date, sunTimes.sunset, sunTimes.night));
  const nightReadings = readings.filter(r => !isTimeInRange(r.date, sunTimes.dawn, sunTimes.night));

  // Calculate correlations with proper error handling
  const temperatureCorrelation = calculateCorrelation(readings, weatherData.temp);
  const humidityCorrelation = calculateCorrelation(readings, weatherData.humidity);
  const pressureCorrelation = calculateCorrelation(readings, weatherData.pressure);

  return {
    weatherConditions: {
      temperature: roundToDecimal(weatherData.temp, 2),
      humidity: weatherData.humidity,
      pressure: weatherData.pressure,
      weather: weatherData.weather
    },
    circadianAnalysis: {
      dawn: calculateStats(dawnReadings),
      day: calculateStats(dayReadings),
      dusk: calculateStats(duskReadings),
      night: calculateStats(nightReadings)
    },
    correlations: {
      temperatureCorrelation: temperatureCorrelation || 0,
      humidityCorrelation: humidityCorrelation || 0,
      pressureCorrelation: pressureCorrelation || 0
    }
  };
};

const fetchWeatherData = async (location: Location): Promise<WeatherData | null> => {
  try {
    const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenWeather API key is not configured');
    }

    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${location.latitude}&lon=${location.longitude}&units=metric&appid=${apiKey}`
    );
    
    return {
      temp: response.data.main.temp,
      humidity: response.data.main.humidity,
      pressure: response.data.main.pressure,
      weather: response.data.weather[0].main
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      console.error('Invalid or missing OpenWeather API key');
    } else {
      console.error('Failed to fetch weather data:', error);
    }
    return null;
  }
};

const isTimeInRange = (timestamp: number, start: Date, end: Date): boolean => {
  const date = new Date(timestamp);
  const hours = date.getHours() + date.getMinutes() / 60;
  const startHours = start.getHours() + start.getMinutes() / 60;
  const endHours = end.getHours() + end.getMinutes() / 60;
  
  return hours >= startHours && hours < endHours;
};

const calculateStats = (readings: NightscoutEntry[]) => {
  if (!readings.length) return null;
  
  const values = readings.map(r => r.sgv); // Keep in original mg/dL
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  
  return {
    mean: roundToDecimal(mean, 1), // Keep in mg/dL, let UI handle conversion
    standardDeviation: roundToDecimal(Math.sqrt(variance), 1), // Keep in mg/dL, let UI handle conversion
    count: values.length
  };
};

const calculateCorrelation = (readings: NightscoutEntry[], weatherValue: number): number => {
  if (!readings.length || typeof weatherValue !== 'number') return 0;
  
  const glucoseValues = readings.map(r => toMmol(r.sgv));
  const weatherValues = new Array(readings.length).fill(weatherValue);
  
  const meanGlucose = glucoseValues.reduce((a, b) => a + b, 0) / glucoseValues.length;
  const meanWeather = weatherValue;
  
  let numerator = 0;
  let denominatorGlucose = 0;
  let denominatorWeather = 0;
  
  for (let i = 0; i < glucoseValues.length; i++) {
    const glucoseDiff = glucoseValues[i] - meanGlucose;
    const weatherDiff = weatherValues[i] - meanWeather;
    
    numerator += glucoseDiff * weatherDiff;
    denominatorGlucose += glucoseDiff * glucoseDiff;
    denominatorWeather += weatherDiff * weatherDiff;
  }
  
  const denominator = Math.sqrt(denominatorGlucose * denominatorWeather);
  if (denominator === 0) return 0;
  
  const correlation = numerator / denominator;
  return isNaN(correlation) ? 0 : roundToDecimal(correlation, 2);
};