const { createClient } = require('@supabase/supabase-js');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'surat-pdf';

const supabase = URL && KEY ? createClient(URL, KEY) : null;
const ready = !!supabase;

module.exports = { supabase, ready, BUCKET };
