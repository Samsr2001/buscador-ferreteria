const express = require('express');
const router = express.Router();
const supabase = require('../../database/supabase');

// Caché en memoria para búsquedas recientes
const cache = {};

// Obtener vector desde Gemini (usando el modelo que acepta tu proxy)
async function getEmbedding(text) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiApiKey.trim()}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] }
    })
  });

  if (!response.ok) {
    throw new Error(`Error en Gemini: ${response.statusText}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', architecture: 'Fase 2 (Express + pgvector)', timestamp: new Date().toISOString() });
});

router.get('/tutorial', async (req, res) => {
  res.json({ tip: 'Recuerda usar equipo de seguridad adecuado para tus proyectos.' });
});

router.post('/', async (req, res) => {
  const { query } = req.body;
  
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return res.status(400).json({ error: 'Búsqueda inválida.' });
  }

  const terminoNormalizado = query.trim().toLowerCase();
  
  // 1. Verificar caché
  if (cache[terminoNormalizado] && (Date.now() - cache[terminoNormalizado].timestamp < 300000)) {
    console.log(`[API] ⚡ CACHÉ HIT: "${terminoNormalizado}"`);
    return res.json(cache[terminoNormalizado].data);
  }

  try {
    console.log(`[API] 🧠 Vectorizando búsqueda: "${terminoNormalizado}"`);
    
    // 2. IA: Convertimos el texto del usuario a un Vector Matemático
    const queryVector = await getEmbedding(terminoNormalizado);

    console.log(`[API] 🔍 Buscando en Supabase (Búsqueda Híbrida)...`);
    
    // 3. Llamamos a nuestra función de Postgres que combina Vectores + Texto
    const { data: resultados, error } = await supabase.rpc('busqueda_hibrida', {
      query_text: terminoNormalizado,
      query_embedding: queryVector,
      match_count: 6 // Traemos los 6 mejores
    });

    if (error) throw error;

    // 4. Clasificamos los resultados (Lógica de negocio simple)
    // Los primeros 2 son el "producto ideal", los siguientes actúan como sustitutos/complementarios
    let productos = [];
    let sustitutos = [];
    let complementarios = [];

    if (resultados && resultados.length > 0) {
      productos = resultados.slice(0, 2); // Top 2 resultados directos
      
      if (resultados.length > 2) {
        sustitutos = resultados.slice(2, 4); // Siguientes 2 como alternativas
      }
      if (resultados.length > 4) {
        complementarios = resultados.slice(4, 6); // Siguientes 2 como complementarios
      }
    }

    const respuestaFinal = { productos, sustitutos, complementarios };

    // Guardar en caché
    cache[terminoNormalizado] = { data: respuestaFinal, timestamp: Date.now() };

    return res.json(respuestaFinal);

  } catch (error) {
    console.error(`[API] ❌ Error en la búsqueda inteligente:`, error.message);
    
    // Paracaídas de emergencia por si algo falla
    return res.json({
      productos: [
        { id: "fake-1", nombre: "Ocurrió un error con la IA", descripcion: "Por favor intenta de nuevo.", precio: 0, stock: 0, marca: "Error", categoria: "Error" }
      ],
      sustitutos: [],
      complementarios: []
    });
  }
});

module.exports = router;
