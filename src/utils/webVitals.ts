import { useState, useEffect } from 'react';
import { onCLS, onLCP, onFCP, onTTFB, onINP, type Metric } from 'web-vitals';

type MetricHandler = (metric: Metric) => void;

interface WebVitalsConfig {
  debug?: boolean;
  reportToAnalytics?: boolean;
  analyticsEndpoint?: string;
}

const defaultConfig: WebVitalsConfig = {
  debug: import.meta.env.DEV,
  reportToAnalytics: import.meta.env.PROD,
};

// Performance thresholds based on Google's recommendations
const thresholds = {
  LCP: { good: 2500, needsImprovement: 4000 },
  INP: { good: 200, needsImprovement: 500 }, // INP replaced FID in 2024
  CLS: { good: 0.1, needsImprovement: 0.25 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 },
};

type MetricName = keyof typeof thresholds;

const getRating = (name: MetricName, value: number): 'good' | 'needs-improvement' | 'poor' => {
  const threshold = thresholds[name];
  if (!threshold) return 'good';
  
  if (value <= threshold.good) return 'good';
  if (value <= threshold.needsImprovement) return 'needs-improvement';
  return 'poor';
};

const formatMetricValue = (name: string, value: number): string => {
  if (name === 'CLS') {
    return value.toFixed(3);
  }
  return `${Math.round(value)}ms`;
};

// Store metrics for later retrieval
const metricsStore: Map<string, Metric> = new Map();

export const getStoredMetrics = () => {
  return Object.fromEntries(metricsStore);
};

const createMetricHandler = (config: WebVitalsConfig): MetricHandler => {
  return (metric: Metric) => {
    const { name, value, id, rating } = metric;
    
    // Store the metric
    metricsStore.set(name, metric);
    
    // Debug logging in development
    if (config.debug) {
      const formattedValue = formatMetricValue(name, value);
      const emoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';
      
      console.log(
        `%c[Web Vitals] ${emoji} ${name}: ${formattedValue} (${rating})`,
        `color: ${rating === 'good' ? '#10b981' : rating === 'needs-improvement' ? '#f59e0b' : '#ef4444'}; font-weight: bold;`
      );
      
      // Log additional details
      console.log(`  ID: ${id}`);
      if (metric.entries.length > 0) {
        console.log(`  Entries:`, metric.entries);
      }
    }
    
    // Report to analytics in production
    if (config.reportToAnalytics) {
      reportMetricToAnalytics(metric, config);
    }
    
    // Dispatch custom event for other parts of the app to listen
    window.dispatchEvent(new CustomEvent('web-vitals', { 
      detail: { 
        name, 
        value, 
        rating,
        id,
        delta: metric.delta,
        navigationType: metric.navigationType,
      } 
    }));
  };
};

const reportMetricToAnalytics = async (metric: Metric, config: WebVitalsConfig) => {
  const { name, value, id, rating, delta, navigationType } = metric;
  
  // Prepare the payload
  const payload = {
    name,
    value,
    rating,
    id,
    delta,
    navigationType,
    page: window.location.pathname,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    connection: (navigator as unknown as { connection?: { effectiveType?: string } }).connection?.effectiveType || 'unknown',
  };
  
  // If you have an analytics endpoint, send the data
  if (config.analyticsEndpoint) {
    try {
      // Use sendBeacon for reliability (won't be cancelled on page unload)
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          config.analyticsEndpoint,
          JSON.stringify(payload)
        );
      } else {
        await fetch(config.analyticsEndpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('[Web Vitals] Failed to report metric:', error);
    }
  }
  
  // Log to console in a structured format for log aggregation
  if (import.meta.env.PROD) {
    console.log(JSON.stringify({
      type: 'web-vitals',
      ...payload,
    }));
  }
};

export const initWebVitals = (customConfig: Partial<WebVitalsConfig> = {}) => {
  const config = { ...defaultConfig, ...customConfig };
  const handler = createMetricHandler(config);
  
  // Core Web Vitals (2024+)
  onLCP(handler);
  onINP(handler); // INP replaced FID as Core Web Vital in March 2024
  onCLS(handler);
  
  // Additional metrics
  onFCP(handler);
  onTTFB(handler);
  
  if (config.debug) {
    console.log('%c[Web Vitals] Monitoring initialized', 'color: #8b5cf6; font-weight: bold;');
  }
  
  return {
    getMetrics: getStoredMetrics,
  };
};

// React hook for accessing web vitals
export const useWebVitals = () => {
  const [metrics, setMetrics] = useState<Record<string, Metric>>({});
  
  useEffect(() => {
    const handleVitals = (event: CustomEvent) => {
      const { name } = event.detail;
      setMetrics(prev => ({
        ...prev,
        [name]: event.detail,
      }));
    };
    
    window.addEventListener('web-vitals', handleVitals as EventListener);
    
    // Get any metrics that were already collected
    setMetrics(getStoredMetrics());
    
    return () => {
      window.removeEventListener('web-vitals', handleVitals as EventListener);
    };
  }, []);
  
  return metrics;
};

// Helper to get performance score (0-100)
export const calculatePerformanceScore = (metrics: Record<string, Metric>): number => {
  const weights = {
    LCP: 0.25,
    INP: 0.30, // INP is now a Core Web Vital
    CLS: 0.25,
    FCP: 0.10,
    TTFB: 0.10,
  };
  
  let score = 0;
  let totalWeight = 0;
  
  for (const [name, weight] of Object.entries(weights)) {
    const metric = metrics[name];
    if (metric) {
      const metricRating = metric.rating;
      const metricScore = metricRating === 'good' ? 100 : metricRating === 'needs-improvement' ? 50 : 0;
      score += metricScore * weight;
      totalWeight += weight;
    }
  }
  
  return totalWeight > 0 ? Math.round(score / totalWeight * 100) / 100 : 0;
};
