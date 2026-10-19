export type AdminResult = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: Date;
  createdById: string | null;
};

export type AdminListResult = {
  items: AdminResult[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type OwnProfileResult = {
  admin: AdminResult;
  passwordChanged: boolean;
};

// RN32: what the administrator sees about a student. The CPF comes masked and
// the password hash is never part of it.
export type AdminStudentResult = {
  id: string;
  name: string;
  email: string;
  cpf: string;
  active: boolean;
  createdAt: Date;
};

export type AdminStudentListResult = {
  items: AdminStudentResult[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
