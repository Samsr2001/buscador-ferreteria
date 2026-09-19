const express = require('express');
const router = express.Router();

// URL de tu automatización en n8n
const N8N_WEBHOOK_URL = 'http://68.155.150.242/webhook/887099d0-a042-41bb-8d84-e1c0cfe0c7e6';
const N8N_TIMEOUT_MS = 25000; // 25 seconds — n8n + Gemini can be slow

// Diccionario en memoria para almacenar las búsquedas recientes (Caché)
const cache = {};

// GET /api/buscar/health — basic uptime check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', n8n_url: N8N_WEBHOOK_URL, timestamp: new Date().toISOString() });
});

router.post('/', async (req, res) => {
  const { query } = req.body;
  
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return res.status(400).json({ error: 'El término de búsqueda debe tener al menos 2 caracteres.' });
  }

  // Normalización avanzada: sin tildes, minúsculas, y un solo espacio entre palabras
  const terminoNormalizado = query
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
    .replace(/\s+/g, " ");

  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de memoria límite

  // 1. Verificamos si ya buscamos esto antes (HIT DE CACHÉ) y si no caducó (TTL)
  const cacheEntry = cache[terminoNormalizado];
  if (cacheEntry && (Date.now() - cacheEntry.timestamp < CACHE_TTL_MS)) {
    console.log(`[API] ⚡ CACHÉ HIT para: "${terminoNormalizado}" (Evitamos llamar a la IA)`);
    return res.json(cacheEntry.data);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  try {
    console.log(`[API] 🧠 Iniciando búsqueda inteligente en IA para: "${terminoNormalizado}"`);

    // 2. Delegar el procesamiento a la capa de IA (n8n)
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ busqueda: terminoNormalizado }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 3. Obtener respuesta
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

    let sustitutosEncontrados = [];

    // LÓGICA DE SUSTITUTOS CON IA
    if (productosEncontrados.length === 0) {
      console.log(`[API] 🔄 No hay stock de "${terminoNormalizado}". Pidiendo sustituto a la IA...`);
      
      // Le mandamos un prompt "hackeado" a n8n para que Gemini busque una alternativa
      const promptSustituto = `${terminoNormalizado} (AVISO PARA LA IA: No hay stock de esto. Dime UNA alternativa funcional o sustituto. SOLO UNA PALABRA GENÉRICA).`;
      
      try {
        const resSus = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ busqueda: promptSustituto }),
        });
        
        const txtSus = await resSus.text();
        let dataSus = txtSus;
        try { dataSus = JSON.parse(txtSus); } catch(e) {}
        
        if (resSus.ok && !(resSus.status === 500 && dataSus?.message === 'No item to return was found')) {
           sustitutosEncontrados = Array.isArray(dataSus) ? dataSus : (Object.keys(dataSus).length > 0 ? [dataSus] : []);
        }
      } catch (e) {
        console.error("[API] Error buscando sustituto:", e.message);
      }
    }

    let complementariosEncontrados = [];

    // LÓGICA DE VENTA CRUZADA (COMPLEMENTARIOS)
    if (productosEncontrados.length > 0) {
      console.log(`[API] 🛒 Buscando producto complementario para venta cruzada...`);
      
      const promptComplementario = `${terminoNormalizado} (AVISO PARA IA: Ignora la búsqueda anterior. Dime UNA SOLA PALABRA GENÉRICA de una herramienta o material complementario que se use junto con esto. Ej: si buscan pintura, devuelve pincel o lija).`;
      
      try {
        const resComp = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ busqueda: promptComplementario }),
        });
        
        const txtComp = await resComp.text();
        let dataComp = txtComp;
        try { dataComp = JSON.parse(txtComp); } catch(e) {}
        
        if (resComp.ok && !(resComp.status === 500 && dataComp?.message === 'No item to return was found')) {
           complementariosEncontrados = Array.isArray(dataComp) ? dataComp : (Object.keys(dataComp).length > 0 ? [dataComp] : []);
           
           // Filtramos para asegurarnos de no sugerir exactamente el mismo producto que ya encontraron
           if (productosEncontrados.length > 0 && complementariosEncontrados.length > 0) {
             complementariosEncontrados = complementariosEncontrados.filter(c => c.id !== productosEncontrados[0].id);
           }
        }
      } catch (e) {
        console.error("[API] Error buscando complementario:", e.message);
      }
    }

    const respuestaFinal = { 
      productos: productosEncontrados,
      sustitutos: sustitutosEncontrados,
      complementarios: complementariosEncontrados
    };

    // 4. Guardamos la respuesta en el caché con una marca de tiempo (para el TTL)
    cache[terminoNormalizado] = {
      data: respuestaFinal,
      timestamp: Date.now()
    };

    // 5. Devolver la estructura que exige swagger.yaml
    res.json(respuestaFinal);

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
