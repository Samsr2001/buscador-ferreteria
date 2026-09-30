const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY (necesitás la Service Role Key para hacer UPDATE ahora que RLS está activo)');
  process.exit(1);
}

if (!geminiApiKey) {
  console.error('Missing GEMINI_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  // Fetch all rows where embedding IS NULL
  const { data: productos, error } = await supabase
    .from('productos')
    .select('id, nombre, descripcion')
    .is('embedding', null);

  if (error) {
    console.error('Error fetching products:', error);
    process.exit(1);
  }

  if (!productos || productos.length === 0) {
    console.log('No products to update.');
    return;
  }

  console.log(`Found ${productos.length} products without embeddings.`);

  for (let i = 0; i < productos.length; i++) {
    const p = productos[i];
    const text = `Producto: ${p.nombre}. Descripción: ${p.descripcion || ''}`;
    
    console.log(`[${i+1}/${productos.length}] Generating embedding for: ${p.nombre}`);
    
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiApiKey.trim()}`;
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: {
            parts: [{ text: text }]
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${response.statusText} - Detalles: ${errorText}`);
      }

      const data = await response.json();
      const embedding = data.embedding?.values;

      if (!embedding) {
        throw new Error('No embedding returned from Gemini API');
      }

      // Update the row in Supabase
      const { error: updateError } = await supabase
        .from('productos')
        .update({ embedding })
        .eq('id', p.id);

      if (updateError) {
        console.error(`  -> Error updating product ${p.id} in Supabase:`, updateError);
      } else {
        console.log(`  -> Successfully updated product ${p.id}`);
      }
    } catch (e) {
      console.error(`  -> Failed: ${e.message}`);
    }

    // CRITICAL: Sleep for 2000ms
    if (i < productos.length - 1) {
      await delay(2000);
    }
  }
  
  console.log('Finished updating embeddings.');
}

main();
