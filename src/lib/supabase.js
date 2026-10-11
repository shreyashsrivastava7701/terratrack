// supabase.js: the connection to the online database. It is only switched on when
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are in .env; without them the app runs
// on this device only, exactly as before. The anon key is meant to be public: the
// security rules in supabase.sql decide who can read or change what.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const cloudEnabled = Boolean(url && key && !url.includes('xxxx'));
export const supabase = cloudEnabled ? createClient(url, key) : null;
