import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://ehiyxqttyzijfwtrzlkb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) { 
    console.warn('[Supabase] Faltan credenciales en el entorno'); 
}

export const supabase = createClient(supabaseUrl, supabaseKey);
