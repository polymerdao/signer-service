import { z } from 'zod';

const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

const AccessListSchema = z.array(
  z.object({
    address: AddressSchema,
    storageKeys: z.array(z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid storage key')),
  }),
);

export const TransactionArgsSchema = z.object({
  from: AddressSchema,
  to: AddressSchema,
  gasLimit: z.string().optional(),
  gas: z.string(),
  gasPrice: z.string().nullable().optional(),
  maxFeePerGas: z.string().nullable().optional(),
  maxPriorityFeePerGas: z.string().nullable().optional(),
  value: z.string(),
  nonce: z.string(),
  input: z.string(),
  accessList: AccessListSchema.optional(),
  chainId: z.string(),
  blobVersionedHashes: z.array(z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid hash')).optional(),
  maxFeePerBlobGas: z.string().optional(),
  type: z.string().optional(),
});

export type TransactionArgs = z.infer<typeof TransactionArgsSchema>;