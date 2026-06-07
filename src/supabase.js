import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://joygtqcjjaaalgxmdqjo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SNYogg2ckBJLfnD4tlqZVg_fVkoRvOg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);