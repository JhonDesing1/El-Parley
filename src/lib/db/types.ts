import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Alias for the typed Supabase client used across all repositories. */
export type DB = SupabaseClient<Database>;

export type Tables = Database["public"]["Tables"];
export type Row<T extends keyof Tables> = Tables[T]["Row"];
export type Insert<T extends keyof Tables> = Tables[T]["Insert"];
export type Update<T extends keyof Tables> = Tables[T]["Update"];
