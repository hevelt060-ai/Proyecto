export interface ApiSuccess<TData> {
  success: true;
  data: TData;
  requestId?: string;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
  requestId: string;
}
