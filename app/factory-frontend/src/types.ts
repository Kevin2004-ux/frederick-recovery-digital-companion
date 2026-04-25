export type OwnerUser = {
  id: string;
  email: string;
  role: "OWNER";
};

export type LoginSuccessResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
};

export type MfaRequiredResponse = {
  mfaRequired: true;
  mfaToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
};

export type AuthMeResponse = {
  id: string;
  email: string;
  role?: string;
};

export type ActivationBatch = {
  id: string;
  clinicTag: string | null;
  quantity: number;
  boxType: string | null;
  includedItems?: Array<{ key?: string; label?: string }>;
  createdAt: string;
  createdByUserId?: string | null;
  codeCounts?: {
    total: number;
    unused: number;
    claimed: number;
    configured: number;
    quantityMismatch: boolean;
  };
};

export type CreateBatchResponse = {
  batch: ActivationBatch;
};
