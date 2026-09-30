const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function fixImages() {
    const { data: productos, error } = await supabase.from('productos').select('id, nombre');
    if (error) { console.error(error); return; }
    
    console.log('Found', productos.length, 'productos');
    for (const p of productos) {
        let filename = p.nombre.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
            
        const url = '/productos/' + filename + '.jpg';
        await supabase.from('productos').update({ imagen_url: url }).eq('id', p.id);
        console.log('Updated', p.nombre, '->', url);
    }
}
fixImages();
