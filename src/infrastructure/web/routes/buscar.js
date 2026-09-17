const express = require('express');
const router = express.Router();

// URL de tu automatización en n8n
const N8N_WEBHOOK_URL = 'http://68.155.150.242/webhook/887099d0-a042-41bb-8d84-e1c0cfe0c7e6';
const N8N_TIMEOUT_MS = 25000; // 25 seconds — n8n + Gemini can be slow

// GET /api/buscar/health — basic uptime check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', n8n_url: N8N_WEBHOOK_URL, timestamp: new Date().toISOString() });
});

router.post('/', async (req, res) => {
  const { query } = req.body;
  
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return res.status(400).json({ error: 'El término de búsqueda debe tener al menos 2 caracteres.' });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  try {
    console.log(`[API] Iniciando búsqueda inteligente para: "${query.trim()}"`);

    // 1. Delegar el procesamiento a la capa de IA (n8n)
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ busqueda: query.trim() }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 2. Obtener respuesta
    const textData = await n8nResponse.text();
    let data;
    try {
      data = JSON.parse(textData);
    } catch (e) {
      data = textData;
    }

    if (!n8nResponse.ok) {
      if (n8nResponse.status === 500 && data && data.message === 'No item to return was found') {
        // n8n tira 500 cuando el nodo de BD no encuentra nada. Lo tratamos como 0 resultados.
        data = [];
      } else {
        console.error(`[API] n8n devolvió error HTTP ${n8nResponse.status}`);
        throw new Error(`El motor de IA está saturado o falló (HTTP ${n8nResponse.status}).`);
      }
    }
    
    // Si la BD devuelve un objeto vacío, lo convertimos a array
    const productosEncontrados = Array.isArray(data) ? data : (Object.keys(data).length > 0 ? [data] : []);

    // 3. Devolver la estructura que exige swagger.yaml
    res.json({ 
      productos: productosEncontrados,
      sustitutos: [] // Preparado para el próximo sprint
    });

  } catch (error) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError';
    console.error(`[API] ${isTimeout ? 'Timeout' : 'Error interno'}:`, error.message);
    res.status(isTimeout ? 504 : 500).json({ 
      error: isTimeout
        ? 'La IA tardó demasiado en responder. Por favor intentá de nuevo en unos segundos.'
        : 'Ocurrió un problema procesando la búsqueda con IA.',
      detalle: error.message,
    });
  }
});

module.exports = router;
