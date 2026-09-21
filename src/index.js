require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const app = express();
const port = process.env.PORT || 3000;
const swaggerDocument = YAML.load('./swagger.yaml');

app.use(cors());
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const buscarRoutes = require('./infrastructure/web/routes/buscar');
app.use('/api/buscar', buscarRoutes);

app.get('/', (req, res) => res.send('API Buscador Ferretería en línea'));
app.get('/api/productos', async (req, res) => {
  try {
    let url = 'https://ehiyxqttyzijfwtrzlkb.supabase.co/rest/v1/productos?select=*';
    const categoria = req.query.categoria;
    if (categoria && categoria !== 'Todas') {
      url += '&categoria=eq.' + encodeURIComponent(categoria);
    }
    const response = await fetch(url, {
      headers: {
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': 'Bearer ' + process.env.SUPABASE_KEY
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${port}`);
});

