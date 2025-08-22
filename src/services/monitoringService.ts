interface PerformanceMetric {
  timestamp: number;
  action: string;
  duration: number;
  success: boolean;
  dataSize?: number;
  error?: string;
}

interface SystemEvent {
  id: string;
  timestamp: number;
  type: 'refresh' | 'timeSelection' | 'dataFetch' | 'error' | 'unresponsive';
  details: any;
  duration?: number;
  resolved?: boolean;
}

interface WeatherData {
  timestamp: number;
  temperature: number;
  humidity: number;
  pressure: number;
  conditions: string;
  location: { lat: number; lng: number };
}

interface UserInteraction {
  timestamp: number;
  action: string;
  component: string;
  timeWindow?: number;
  responseTime: number;
  successful: boolean;
}

class MonitoringService {
  private metrics: PerformanceMetric[] = [];
  private events: SystemEvent[] = [];
  private weatherData: WeatherData[] = [];
  private interactions: UserInteraction[] = [];
  private unresponsivePeriods: Array<{ start: number; end?: number; cause?: string }> = [];
  private performanceStartTimes: Map<string, number> = new Map();

  // Performance tracking
  startPerformanceTracking(action: string): string {
    const id = crypto.randomUUID();
    const startTime = performance.now();
    this.performanceStartTimes.set(id, startTime);
    return id;
  }

  endPerformanceTracking(id: string, action: string, success: boolean, error?: string, dataSize?: number) {
    const endTime = performance.now();
    const startTime = this.performanceStartTimes.get(id);
    const duration = startTime !== undefined ? endTime - startTime : 0;
    this.performanceStartTimes.delete(id);

    this.metrics.push({
      timestamp: Date.now(),
      action,
      duration,
      success,
      dataSize,
      error
    });

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  // System event logging
  logSystemEvent(type: SystemEvent['type'], details: any, duration?: number) {
    const event: SystemEvent = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type,
      details,
      duration,
      resolved: false
    };

    this.events.push(event);

    // Auto-resolve certain events after timeout
    if (type === 'unresponsive') {
      setTimeout(() => {
        this.resolveEvent(event.id);
      }, 30000); // Auto-resolve after 30 seconds
    }

    // Keep only last 500 events
    if (this.events.length > 500) {
      this.events = this.events.slice(-500);
    }
  }

  resolveEvent(eventId: string) {
    const event = this.events.find(e => e.id === eventId);
    if (event) {
      event.resolved = true;
    }
  }

  // Weather data collection
  async collectWeatherData(location: { lat: number; lng: number }) {
    try {
      if (!import.meta.env.VITE_OPENWEATHER_API_KEY) {
        console.warn('Weather monitoring disabled - no API key');
        return;
      }

      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lng}&units=metric&appid=${import.meta.env.VITE_OPENWEATHER_API_KEY}`
      );
      
      if (response.ok) {
        const data = await response.json();
        
        this.weatherData.push({
          timestamp: Date.now(),
          temperature: data.main.temp,
          humidity: data.main.humidity,
          pressure: data.main.pressure,
          conditions: data.weather[0].main,
          location
        });

        // Keep only last 100 weather readings
        if (this.weatherData.length > 100) {
          this.weatherData = this.weatherData.slice(-100);
        }
      }
    } catch (error) {
      console.error('Weather data collection failed:', error);
    }
  }

  // User interaction tracking
  trackUserInteraction(action: string, component: string, timeWindow?: number) {
    const startTime = performance.now();
    
    return {
      complete: (successful: boolean = true) => {
        const responseTime = performance.now() - startTime;
        
        this.interactions.push({
          timestamp: Date.now(),
          action,
          component,
          timeWindow,
          responseTime,
          successful
        });

        // Detect unresponsive periods (>5 seconds)
        if (responseTime > 5000) {
          this.logSystemEvent('unresponsive', {
            action,
            component,
            responseTime,
            timeWindow
          }, responseTime);
        }

        // Keep only last 1000 interactions
        if (this.interactions.length > 1000) {
          this.interactions = this.interactions.slice(-1000);
        }
      }
    };
  }

  // Analysis methods
  analyzePerformanceForPeriod(startTime: number, endTime: number) {
    const periodMetrics = this.metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );

    const periodEvents = this.events.filter(e => 
      e.timestamp >= startTime && e.timestamp <= endTime
    );

    const periodInteractions = this.interactions.filter(i => 
      i.timestamp >= startTime && i.timestamp <= endTime
    );

    const periodWeather = this.weatherData.filter(w => 
      w.timestamp >= startTime && w.timestamp <= endTime
    );

    return {
      metrics: periodMetrics,
      events: periodEvents,
      interactions: periodInteractions,
      weather: periodWeather,
      summary: this.generatePeriodSummary(periodMetrics, periodEvents, periodInteractions)
    };
  }

  private generatePeriodSummary(metrics: PerformanceMetric[], events: SystemEvent[], interactions: UserInteraction[]) {
    const totalInteractions = interactions.length;
    const successfulInteractions = interactions.filter(i => i.successful).length;
    const averageResponseTime = interactions.reduce((sum, i) => sum + i.responseTime, 0) / totalInteractions || 0;
    
    const refreshEvents = events.filter(e => e.type === 'refresh');
    const errorEvents = events.filter(e => e.type === 'error');
    const unresponsiveEvents = events.filter(e => e.type === 'unresponsive');
    
    const timeSelectionIssues = interactions.filter(i => 
      i.action === 'timeWindowChange' && (!i.successful || i.responseTime > 3000)
    );

    return {
      totalInteractions,
      successRate: (successfulInteractions / totalInteractions) * 100 || 0,
      averageResponseTime,
      refreshCount: refreshEvents.length,
      errorCount: errorEvents.length,
      unresponsiveCount: unresponsiveEvents.length,
      timeSelectionIssues: timeSelectionIssues.length,
      slowInteractions: interactions.filter(i => i.responseTime > 2000).length
    };
  }

  // Generate comprehensive report
  generateComprehensiveReport(days: number = 7) {
    const endTime = Date.now();
    const startTime = endTime - (days * 24 * 60 * 60 * 1000);
    
    const analysis = this.analyzePerformanceForPeriod(startTime, endTime);
    
    return {
      reportGenerated: new Date().toISOString(),
      period: {
        start: new Date(startTime).toISOString(),
        end: new Date(endTime).toISOString(),
        days
      },
      summary: analysis.summary,
      detailedFindings: this.generateDetailedFindings(analysis),
      recommendations: this.generateRecommendations(analysis),
      weatherCorrelations: this.analyzeWeatherCorrelations(analysis.weather, analysis.events),
      performanceMetrics: this.calculatePerformanceMetrics(analysis.metrics),
      issueBreakdown: this.categorizeIssues(analysis.events),
      reproductionSteps: this.generateReproductionSteps(analysis.events)
    };
  }

  private generateDetailedFindings(analysis: any) {
    const findings = [];
    
    // Analyze refresh patterns
    const refreshEvents = analysis.events.filter((e: SystemEvent) => e.type === 'refresh');
    if (refreshEvents.length > 0) {
      findings.push({
        category: 'Refresh Behavior',
        severity: refreshEvents.length > 10 ? 'high' : 'medium',
        description: `${refreshEvents.length} refresh events detected`,
        timestamps: refreshEvents.map((e: SystemEvent) => new Date(e.timestamp).toISOString()),
        impact: 'User experience degradation'
      });
    }

    // Analyze time selection issues
    const timeSelectionIssues = analysis.interactions.filter((i: UserInteraction) => 
      i.action === 'timeWindowChange' && i.responseTime > 3000
    );
    
    if (timeSelectionIssues.length > 0) {
      findings.push({
        category: 'Time Selection Performance',
        severity: 'high',
        description: `${timeSelectionIssues.length} slow time selection operations`,
        averageDelay: timeSelectionIssues.reduce((sum: number, i: UserInteraction) => sum + i.responseTime, 0) / timeSelectionIssues.length,
        affectedTimeWindows: [...new Set(timeSelectionIssues.map((i: UserInteraction) => i.timeWindow))],
        impact: 'System becomes unresponsive during time window changes'
      });
    }

    // Analyze unresponsive periods
    const unresponsiveEvents = analysis.events.filter((e: SystemEvent) => e.type === 'unresponsive');
    if (unresponsiveEvents.length > 0) {
      findings.push({
        category: 'System Responsiveness',
        severity: 'critical',
        description: `${unresponsiveEvents.length} unresponsive periods detected`,
        totalDowntime: unresponsiveEvents.reduce((sum: number, e: SystemEvent) => sum + (e.duration || 0), 0),
        longestOutage: Math.max(...unresponsiveEvents.map((e: SystemEvent) => e.duration || 0)),
        impact: 'Complete system unresponsiveness'
      });
    }

    return findings;
  }

  private generateRecommendations(analysis: any) {
    const recommendations = [];
    
    if (analysis.summary.timeSelectionIssues > 0) {
      recommendations.push({
        priority: 'high',
        category: 'Performance',
        issue: 'Slow time window selection',
        solution: 'Implement intelligent data caching and avoid unnecessary data fetching',
        implementation: 'Add hasEnoughData() checks before fetchDataForDays() calls'
      });
    }

    if (analysis.summary.refreshCount > 5) {
      recommendations.push({
        priority: 'high',
        category: 'User Experience',
        issue: 'Excessive refresh operations',
        solution: 'Optimize data fetching logic to prevent unnecessary refreshes',
        implementation: 'Implement smarter data validation and caching strategies'
      });
    }

    if (analysis.summary.averageResponseTime > 2000) {
      recommendations.push({
        priority: 'medium',
        category: 'Performance',
        issue: 'Slow average response time',
        solution: 'Implement data sampling and async processing for large datasets',
        implementation: 'Use Web Workers for heavy computations and intelligent data sampling'
      });
    }

    return recommendations;
  }

  private analyzeWeatherCorrelations(weather: WeatherData[], events: SystemEvent[]) {
    if (weather.length === 0) return null;
    
    const correlations = {
      temperatureVsErrors: 0,
      humidityVsPerformance: 0,
      pressureVsResponsiveness: 0,
      weatherEvents: weather.map(w => ({
        timestamp: new Date(w.timestamp).toISOString(),
        conditions: w.conditions,
        temperature: w.temperature,
        humidity: w.humidity,
        pressure: w.pressure,
        concurrentIssues: events.filter(e => 
          Math.abs(e.timestamp - w.timestamp) < 3600000 // Within 1 hour
        ).length
      }))
    };

    return correlations;
  }

  private calculatePerformanceMetrics(metrics: PerformanceMetric[]) {
    if (metrics.length === 0) return null;

    const successfulMetrics = metrics.filter(m => m.success);
    const failedMetrics = metrics.filter(m => !m.success);

    return {
      totalOperations: metrics.length,
      successRate: (successfulMetrics.length / metrics.length) * 100,
      averageDuration: metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length,
      slowestOperation: Math.max(...metrics.map(m => m.duration)),
      fastestOperation: Math.min(...metrics.map(m => m.duration)),
      failureRate: (failedMetrics.length / metrics.length) * 100,
      commonErrors: this.getCommonErrors(failedMetrics)
    };
  }

  private getCommonErrors(failedMetrics: PerformanceMetric[]) {
    const errorCounts = failedMetrics.reduce((acc, m) => {
      const error = m.error || 'Unknown error';
      acc[error] = (acc[error] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));
  }

  private categorizeIssues(events: SystemEvent[]) {
    const categories = {
      refresh: events.filter(e => e.type === 'refresh'),
      timeSelection: events.filter(e => e.type === 'timeSelection'),
      dataFetch: events.filter(e => e.type === 'dataFetch'),
      unresponsive: events.filter(e => e.type === 'unresponsive'),
      errors: events.filter(e => e.type === 'error')
    };

    return Object.entries(categories).map(([category, categoryEvents]) => ({
      category,
      count: categoryEvents.length,
      averageDuration: categoryEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / categoryEvents.length || 0,
      resolved: categoryEvents.filter(e => e.resolved).length,
      pending: categoryEvents.filter(e => !e.resolved).length
    }));
  }

  private generateReproductionSteps(events: SystemEvent[]) {
    const reproductionSteps = [];

    // Time selection issues
    const timeSelectionIssues = events.filter(e => 
      e.type === 'unresponsive' && e.details.action === 'timeWindowChange'
    );

    if (timeSelectionIssues.length > 0) {
      reproductionSteps.push({
        issue: 'Time selection causes unresponsiveness',
        steps: [
          '1. Navigate to Dashboard',
          '2. Select time window dropdown',
          '3. Choose "2 weeks" or longer period',
          '4. Observe system becomes unresponsive',
          '5. Wait for refresh to complete'
        ],
        expectedBehavior: 'Time window should change instantly without refresh',
        actualBehavior: 'System becomes unresponsive and triggers data fetch',
        frequency: `Occurs ${timeSelectionIssues.length} times in analysis period`
      });
    }

    // Multiple day selection failures
    const multiDayFailures = events.filter(e => 
      e.type === 'error' && e.details.timeWindow > 336
    );

    if (multiDayFailures.length > 0) {
      reproductionSteps.push({
        issue: 'Multiple day selections fail',
        steps: [
          '1. Open Dashboard',
          '2. Select "3 weeks" from dropdown',
          '3. Observe error or infinite loading',
          '4. Try "1 month" selection',
          '5. System fails to respond properly'
        ],
        expectedBehavior: 'Should display data for selected period',
        actualBehavior: 'Fails to load or shows errors',
        frequency: `Occurs ${multiDayFailures.length} times in analysis period`
      });
    }

    return reproductionSteps;
  }

  // Export data for external analysis
  exportMonitoringData() {
    return {
      metrics: this.metrics,
      events: this.events,
      interactions: this.interactions,
      weatherData: this.weatherData,
      exportedAt: new Date().toISOString()
    };
  }
}

// Singleton instance
export const monitoringService = new MonitoringService();