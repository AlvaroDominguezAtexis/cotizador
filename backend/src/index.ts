import app from './app';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});