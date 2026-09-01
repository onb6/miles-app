const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  // Socket.io needs ws:true for WebSocket upgrade; keep it scoped to /socket.io
  // so webpack HMR websockets aren't accidentally proxied
  app.use(
    "/socket.io",
    createProxyMiddleware({
      target: "http://localhost:3001",
      changeOrigin: true,
      ws: true,
    })
  );

  app.use(
    ["/api", "/uploads"],
    createProxyMiddleware({
      target: "http://localhost:3001",
      changeOrigin: true,
    })
  );
};
