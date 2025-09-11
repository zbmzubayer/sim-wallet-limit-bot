export const SIM_TRANSACTION_OPERATION = {
  BK_SM: "BK_SM",
  BK_CO: "BK_CO",
  BK_MER: "BK_MER",
  NG_SM: "NG_SM",
  NG_CO: "NG_CO",
  NG_MER: "NG_MER",
} as const;

export const SIM_TRANSACTION_TYPE = {
  IN: "IN",
  OUT: "OUT",
} as const;

export type SimTransactionOperation =
  (typeof SIM_TRANSACTION_OPERATION)[keyof typeof SIM_TRANSACTION_OPERATION];
export type SimTransactionType = (typeof SIM_TRANSACTION_TYPE)[keyof typeof SIM_TRANSACTION_TYPE];

export const SIM_TRANSACTION_LIMIT = {
  SM_DAILY: 50000,
  SM_MONTHLY: 300000,
  CO_DAILY: 30000,
  CO_MONTHLY: 200000,
} as const;
