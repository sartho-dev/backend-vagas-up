export type ApiResponse<T = any> = {
  status: "success" | "error";
  data?: T;
  message?: string;
};
