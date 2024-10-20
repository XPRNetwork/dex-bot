import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../interfaces/db_scheme";

export const supabase = new SupabaseClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SERVICE_ROLE_KEY!,
);