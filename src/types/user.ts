export interface User {
  id: string;
  name_ar: string;
  name_en: string;
  job_id: number | null;
  email: string;
  phone: string;
  job_number: string;
  status: string;
  avatar_url: string | null | undefined;
  role: string;
  last_login?: string;
}
