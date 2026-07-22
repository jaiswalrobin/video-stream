// src/config/env.js

// Validate required environment variables
const requiredVars = ['VITE_API_URL', 'VITE_CLOUDFRONT_DOMAIN']

requiredVars.forEach(varName => {
  if (!import.meta.env[varName]) {
    console.warn(`⚠️ Missing environment variable: ${varName}`)
  }
})

export const config = {
  // API Configuration
  api: {
    baseUrl: import.meta.env.VITE_API_URL || '',
    timeout: 30000, // 30 seconds
  },
  
  // CloudFront Configuration
  cloudfront: {
    domain: import.meta.env.VITE_CLOUDFRONT_DOMAIN,
    videoBaseUrl: `https://${import.meta.env.VITE_CLOUDFRONT_DOMAIN}/hls`,
  },
  
  // Environment
  environment: import.meta.env.VITE_ENVIRONMENT || 'development',
  isProduction: import.meta.env.PROD,
  isDevelopment: import.meta.env.DEV,
}

// Helper function to get full API URL
export const getApiUrl = (endpoint) => {
  const baseUrl = config.api.baseUrl
  // Remove trailing slash if present
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  // Remove leading slash from endpoint if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  
  return `${cleanBaseUrl}${cleanEndpoint}`
}

// Helper function to get video URL
export const getVideoUrl = (videoId, filename) => {
  return `${config.cloudfront.videoBaseUrl}/${videoId}/${filename}`
}

// Helper function to get thumbnail URL
export const getThumbnailUrl = (videoId) => {
  return getVideoUrl(videoId, 'thumbnail.jpg')
}

// Helper function to get manifest URL
export const getManifestUrl = (videoId) => {
  return getVideoUrl(videoId, 'master.m3u8')
}