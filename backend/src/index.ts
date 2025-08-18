import app from './app';
import { ensureDbConstraints } from './migrations/ensureConstraints';

const PORT = process.env.PORT || 4000;

(async () => {
  await ensureDbConstraints();
  app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
  });
})();