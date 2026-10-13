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
