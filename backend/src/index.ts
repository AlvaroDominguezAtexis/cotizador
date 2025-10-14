import app from './app';

const PORT = process.env.PORT || 4000;

(async () => {
  app.listen(PORT, () => {
    console.log(`🚀 Backend Cotizador corriendo en puerto ${PORT}`);
    console.log(`📡 API disponible en: http://localhost:${PORT}`);
    console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth/*`);
  });
})();