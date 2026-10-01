import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Caché en memoria (nota: en serverless real, esto persiste por lambda container)
const cache: Record<string, { data: any, timestamp: number }> = {};

async function getEmbedding(text: string) {
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
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

async function describeImage(base64Image: string, mimeType: string) {
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey.trim()}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: "Identifica esta herramienta o repuesto de ferretería. Dime SOLO el nombre genérico en 2 a 4 palabras, sin punto final ni explicaciones." },
          { inline_data: { mime_type: mimeType, data: base64Image } }
        ]
      }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error en Gemini Vision: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text.trim();
}

export async function POST(req: Request) {
  try {
    let { query, image } = await req.json();
    
    if (image) {
      console.log(`[API] 📸 Procesando imagen multimodal...`);
      // Extraer mime type
      const match = image.match(/^data:(image\/\w+);base64,/);
      const mimeType = match ? match[1] : 'image/jpeg';
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      
      query = await describeImage(base64Data, mimeType);
      console.log(`[API] 📸 IA detectó: "${query}"`);
    }
    
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json({ error: 'Búsqueda inválida.' }, { status: 400 });
    }

    const terminoNormalizado = query.trim().toLowerCase();
    
    if (cache[terminoNormalizado] && (Date.now() - cache[terminoNormalizado].timestamp < 300000)) {
      console.log(`[API] ⚡ CACHÉ HIT: "${terminoNormalizado}"`);
      return NextResponse.json(cache[terminoNormalizado].data);
    }

    console.log(`[API] 🧠 Vectorizando búsqueda: "${terminoNormalizado}"`);
    const queryVector = await getEmbedding(terminoNormalizado);

    console.log(`[API] 🔍 Buscando en Supabase (Búsqueda Híbrida)...`);
    const { data: resultadosParciales, error } = await supabase.rpc('busqueda_hibrida', {
      query_text: terminoNormalizado,
      query_embedding: queryVector,
      match_count: 6
    });

    if (error) throw error;

    let resultados: any[] = [];
    if (resultadosParciales && resultadosParciales.length > 0) {
      const ids = resultadosParciales.map((r: any) => r.id);
      const { data: productosCompletos, error: errFetch } = await supabase
        .from('productos')
        .select('*')
        .in('id', ids);
      
      if (!errFetch && productosCompletos) {
        resultados = resultadosParciales.map((rp: any) => {
          const completo = productosCompletos.find((p: any) => p.id === rp.id) || {};
          return { ...rp, ...completo };
        });
      } else {
        resultados = resultadosParciales;
      }
    }

    let productos = [];
    let sustitutos = [];
    let complementarios = [];

    if (resultados && resultados.length > 0) {
      productos = resultados.slice(0, 2);
      if (resultados.length > 2) sustitutos = resultados.slice(2, 4);
      if (resultados.length > 4) complementarios = resultados.slice(4, 6);
    }

    const respuestaFinal = { 
      productos, 
      sustitutos, 
      complementarios,
      inferredQuery: image ? terminoNormalizado : undefined
    };

    cache[terminoNormalizado] = { data: respuestaFinal, timestamp: Date.now() };

    return NextResponse.json(respuestaFinal);

  } catch (error: any) {
    console.error(`[API] ❌ Error:`, error.message);
    return NextResponse.json({ error: String(error.message) }, { status: 500 });
  }
}
