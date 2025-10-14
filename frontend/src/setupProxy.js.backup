const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  console.log('🔥 setupProxy.js is being executed!');
  
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:4000',
      changeOrigin: true,
      // No pathRewrite needed - backend expects /api prefix
      onProxyReq: function(proxyReq, req, res) {
        // Log the proxied request
        console.log('🔥 Proxying:', req.method, req.path, 'to', proxyReq.path);
      },
      onProxyRes: function(proxyRes, req, res) {
        console.log('🔥 Proxy response:', proxyRes.statusCode, req.path);
      },
      onError: function(err, req, res) {
        console.error('🔥 Proxy error:', err);
      },
    })
  );
  
  console.log('🔥 Proxy middleware configured for /api -> http://localhost:4000');
};
