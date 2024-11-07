import fastify from 'fastify';
import { TransactionArgs, TransactionArgsSchema } from './types';
import { KMSProviderGCP } from "./KMSProviderGCP";
import { KMSWallets } from "./web3-kms-signer/kms-wallets";
import { Signer } from "./web3-kms-signer/core";
import { loadKZG } from "kzg-wasm";


const app = fastify({
  logger: true,
});

const kmsProvider = new KMSProviderGCP({});
const wallets = new KMSWallets(kmsProvider);

let PROJECT_ID = process.env.PROJECT_ID!
let LOCATION_ID = process.env.LOCATION_ID!
let keyRingId = process.env.KEY_RING_ID!
let keyId = process.env.KEY_ID!
let TX_GASPRICE_LIMIT = BigInt(process.env.TXPRICE_LIMIT!)
let TX_BLOBPRICE_LIMIT = BigInt(process.env.TX_BLOBPRICE_LIMIT!)
let TX_ALPHA = BigInt(process.env.TX_ALPHA ?? "1")
let TX_ALPHA = BigInt(process.env.TX_ALPHA ?? "1")

kmsProvider.setPath({
  projectId: PROJECT_ID,
  locationId: LOCATION_ID,
  keyRingId: keyRingId
});

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


      if (TX_BLOBPRICE_LIMIT > 0 || TX_GASPRICE_LIMIT > 0) {
        let areFeesTooHigh = await feesTooHigh(result.data);
        if (areFeesTooHigh) {
          reply.code(400).send({error: `Fees too high TX_GAS_LIMIT|TX_BLOBPRICE_LIMIT [${TX_GASPRICE_LIMIT} |${TX_BLOBPRICE_LIMIT}] reached`});
          return;
        }
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

app.get('/address', async (_, reply) => {
  const address = await wallets.getAddressHex(keyId);
  return reply.code(200).send(address);
})

/**
* Computes a new gas limit using exponential moving average.
* @param price Current transaction price
* @param limit Current gas limit
* @param alpha Weighting factor (percentage multiplier)
* @returns New gas limit
* @brief Assumes that all inputs are non-negative
*/
function computeLimitEMA(price: bigint, limit: bigint, alpha: bigint) {
  return (price - limit) * alpha / BigInt(100) + limit;
}

async function feesTooHigh(transactionArgs: TransactionArgs)  {
  let maxFeePerGas = BigInt(0);
  let maxPriorityFeePerGas = BigInt(0);
  let maxFeePerBlobGas = BigInt(0);



  if (transactionArgs.maxFeePerGas ){
     maxFeePerGas = BigInt(transactionArgs.maxFeePerGas);
  }
  if (transactionArgs.maxPriorityFeePerGas) {
     maxPriorityFeePerGas = BigInt(transactionArgs.maxPriorityFeePerGas);
  }
  if (transactionArgs.maxFeePerBlobGas) {
     maxFeePerBlobGas = BigInt(transactionArgs.maxFeePerBlobGas);
  }

  var gasPrice = (maxFeePerGas + maxPriorityFeePerGas);
  if (gasPrice > TX_GASPRICE_LIMIT) {
    console.error('Tx fees too high: %d > %d', gasPrice, TX_GASPRICE_LIMIT);
    const newGasLimit = computeLimitEMA(gasPrice, TX_GASPRICE_LIMIT, TX_ALPHA);
    console.log('Updating TX_GASPRICE_LIMIT: %d -> %d', TX_GASPRICE_LIMIT, newGasLimit);
    TX_GASPRICE_LIMIT = newGasLimit;
    return true;
  }

  if (transactionArgs.blobVersionedHashes && transactionArgs.blobVersionedHashes.length > 0) {
    if (maxFeePerBlobGas > TX_BLOBPRICE_LIMIT) {
      console.error('Blob fees too high: %d > %d', maxFeePerBlobGas, TX_BLOBPRICE_LIMIT );
      const newBlobLimit = computeLimitEMA(maxFeePerBlobGas, TX_BLOBPRICE_LIMIT, TX_ALPHA);
      console.log('Updating TX_BLOBPRICE_LIMIT: %d -> %d', TX_BLOBPRICE_LIMIT, newBlobLimit);
      TX_BLOBPRICE_LIMIT = newBlobLimit;
      return true;
    }
  }
  return false;
}

async function handleEthSignTransaction(transactionArgs: TransactionArgs) {
  console.log('Transaction Args:', transactionArgs);
  const kzg = await loadKZG()

  const kmsSigner = new Signer(wallets, Number(transactionArgs.chainId), kzg);
  if (!transactionArgs.gasLimit && transactionArgs.gas) {
    transactionArgs.gasLimit = transactionArgs.gas;
  }

  if (!transactionArgs.type) {
    if (transactionArgs.maxFeePerGas && transactionArgs.maxPriorityFeePerGas) {
      transactionArgs.type = '0x2';
    } else {
      transactionArgs.type = '0x0';
    }

    if (transactionArgs.accessList && transactionArgs.accessList.length > 0) {
      transactionArgs.type = '0x1';
    } else if (transactionArgs.blobVersionedHashes && transactionArgs.blobVersionedHashes.length > 0) {
      transactionArgs.type = '0x3';
    }
  }
  return await kmsSigner.signTransaction({keyId: keyId}, {...transactionArgs, data: transactionArgs.input})
}

const start = async () => {
  try {
    let port = parseInt(process.env.PORT ?? "8000");
    const host = process.env.HOST ?? "0.0.0.0";
    await app.listen({port, host});
    console.log(`Server running at http://localhost:${port}/`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();