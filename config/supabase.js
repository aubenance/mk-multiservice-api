// ── config/supabase.js ────────────────────────────────────
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY manquantes dans .env');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

module.exports = supabase;
