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

// GET /api/buscar/tutorial - Expert Tip via Gemini directly
router.get('/tutorial', async (req, res) => {
  const { producto } = req.query;
  if (!producto) return res.status(400).json({ error: 'Falta el producto' });

  try {
    // Usamos Gemini 3.5 Flash Lite para un tip rápido de seguridad/uso
    const GEMINI_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAaff5qGYkUggZhhdON7sabGUZ7I5IO-MM';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_KEY}`;
    
    const prompt = `Actúa como un experto ferretero experimentado. El cliente está comprando: "${producto}". Escribe UN SOLO CONSEJO de seguridad o tip de uso experto muy breve (máximo 2 líneas). Tono amigable y directo.`;
    
    const apiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    
    const data = await apiRes.json();
    const tip = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Recuerda usar siempre equipo de protección personal adecuado.';
    
    res.json({ tip: tip.replace(/\*/g, '').trim() }); // limpiamos asteriscos de markdown
  } catch (error) {
    console.error("[API] Error al generar tutorial:", error.message);
    res.json({ tip: 'Lee atentamente el manual de instrucciones antes de utilizar esta herramienta.' });
  }
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
    let productosEncontrados = Array.isArray(data) ? data : (Object.keys(data).length > 0 ? [data] : []);
    let extrasParaVentaCruzada = [];

    // 💡 POST-PROCESAMIENTO INTELIGENTE (Solución a lo que pediste):
    // Si el n8n devuelve más de 1 producto, separamos los que coinciden con la palabra principal de los que no.
    if (productosEncontrados.length > 1) {
      const palabraClave = terminoNormalizado.split(' ')[0];
      const exactos = productosEncontrados.filter(p => 
        p.nombre.toLowerCase().includes(palabraClave) || 
        p.categoria.toLowerCase().includes(palabraClave)
      );
      
      // Si logramos aislar el producto exacto, mandamos el resto (ej. el Tarugo) a ventas cruzadas
      if (exactos.length > 0 && exactos.length < productosEncontrados.length) {
        extrasParaVentaCruzada = productosEncontrados.filter(p => !exactos.includes(p));
        productosEncontrados = exactos;
      }
    }

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
           
           // Filtramos para asegurarnos de no sugerir exactamente ningún producto que ya hayan encontrado en la búsqueda principal
           if (productosEncontrados.length > 0 && complementariosEncontrados.length > 0) {
             const idsPrincipales = productosEncontrados.map(p => p.id);
             complementariosEncontrados = complementariosEncontrados.filter(c => !idsPrincipales.includes(c.id));
           }
        }
      } catch (e) {
        console.error("[API] Error buscando complementario:", e.message);
      }
    }

    // Unimos los complementarios de la IA con los "extras" que filtramos arriba del resultado principal
    complementariosEncontrados = [...extrasParaVentaCruzada, ...complementariosEncontrados];
    
    // Y un último filtro por si hay IDs duplicados en la lista final de complementarios
    const complementariosUnicos = [];
    const idsVistos = new Set();
    for (const c of complementariosEncontrados) {
      if (!idsVistos.has(c.id)) {
        idsVistos.add(c.id);
        complementariosUnicos.push(c);
      }
    }
    complementariosEncontrados = complementariosUnicos;

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
