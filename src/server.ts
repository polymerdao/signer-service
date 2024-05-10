import fastify from 'fastify';
import { TransactionArgs, TransactionArgsSchema } from './types';
import { KMSProviderGCP } from "./KMSProviderGCP";
import { KMSWallets } from "./web3-kms-signer/kms-wallets";
import { Signer } from "./web3-kms-signer/core";


const app = fastify({
  logger: true,
});

const kmsProvider = new KMSProviderGCP({});
const wallets = new KMSWallets(kmsProvider);

let PROJECT_ID = process.env.PROJECT_ID!
let LOCATION_ID = process.env.LOCATION_ID!
let keyRingId = process.env.KEY_RING_ID!
let keyId = process.env.KEY_ID!

app.post('/', async (request, reply) => {
  const {method, params} = request.body as { method: string, params: any };

  switch (method) {
    case 'eth_signTransaction':
      let result = TransactionArgsSchema.safeParse(params[0])
      if (!result.success) {
        console.error('Validation Error:', result.error);
        reply.code(400).send({error: 'Invalid request'});
        return;
      }
      let signedTx = await handleEthSignTransaction(result.data);
      reply.code(200).send({result: signedTx});
      return;
    case 'health_status':
      return reply.code(200).send({result: 'ok'});
    default:
      reply.code(400).send({error: 'Method not supported'});
  }
});

async function handleEthSignTransaction(transactionArgs: TransactionArgs) {
  console.log('Transaction Args:', transactionArgs);
  kmsProvider.setPath({
    projectId: PROJECT_ID,
    locationId: LOCATION_ID,
    keyRingId: keyRingId
  });

  const kmsSigner = new Signer(wallets, Number(transactionArgs.chainId));
  if (!transactionArgs.gasLimit && transactionArgs.gas) {
    transactionArgs.gasLimit = transactionArgs.gas;
  }
  if (!transactionArgs.type) {
    if (transactionArgs.maxFeePerGas && transactionArgs.maxPriorityFeePerGas) {
      transactionArgs.type = '0x2';
    } else if (transactionArgs.accessList) {
      transactionArgs.type = '0x1';
    } else if (transactionArgs.blobVersionedHashes && transactionArgs.blobVersionedHashes.length > 0) {
      transactionArgs.type = '0x3';
    } else {
      transactionArgs.type = '0x0';
    }
  }
  return await kmsSigner.signTransaction({keyId: keyId}, transactionArgs)
}

const start = async () => {
  try {
    let port = parseInt(process.env.PORT ?? "8000");
    await app.listen({port: port});
    console.log(`Server running at https://localhost:${port}/`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();