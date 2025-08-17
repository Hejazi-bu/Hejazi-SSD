export interface User {
  id: string;
  uuid?: string;
  created_at?: string;

  name_ar?: string | null;
  name_en?: string | null;
  job_id?: number | null;
  job_number?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  avatar_url?: string | null;
  last_login?: string;

  isFallback?: boolean;
}
