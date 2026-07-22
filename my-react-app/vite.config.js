import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load environment variables based on mode
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    base: "/",
    resolve: {
      conditions: ['browser', 'module', 'import', 'default'],
    },
    
    // Proxy configuration for development
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_URL,
          changeOrigin: true,
          secure: false,
          // Only proxy in development
          configure: (proxy, options) => {
            if (env.VITE_ENVIRONMENT === 'production') {
              // Disable proxy in production
              proxy.off('proxyReq')
            }
          }
        }
      }
    },
    
    // Build configuration
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      // Optimize for production
      rollupOptions: {
        output: {
          manualChunks(id) {
          if (id.includes('node_modules')) {
            // This groups all node_modules into a single 'vendor' chunk
            return 'vendor'; 
            
            // OR split them specifically:
            // if (id.includes('react') || id.includes('react-dom')) return 'react-vendor';
            // return 'other-vendor';
          }
        }
        }
      }
    },
    
    // Define global constants
    define: {
      'import.meta.env.VITE_CLOUDFRONT_DOMAIN': JSON.stringify(env.VITE_CLOUDFRONT_DOMAIN)
    }
  }
})
