// Public analytics endpoint. The service owns all private credentials.
export const ANALYTICS_URL = "https://academic-homepage-visitors.xiaohaoyanglei.workers.dev";

// Add only verified entries that share the same database and event receipts.
export const ANALYTICS_URLS: readonly string[] = [
  ANALYTICS_URL,
  "https://xiaohaoyanglei-visitors.netlify.app/analytics",
];
