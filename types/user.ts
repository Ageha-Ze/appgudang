export interface UserData {
  id: number;
  username: string;
  password?: string;
  level: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserFormData {
  username: string;
  password: string;
  level: string;
  updatePassword?: boolean;
}
