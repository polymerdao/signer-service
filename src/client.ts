import axios from 'axios';
import { TransactionArgs } from "./types";
import Web3 from "web3";
import { ethers, formatUnits, TransactionResponse, } from "ethers";
import { loadKZG } from 'kzg-wasm'
import {
  addHexPrefix,
  blobsToCommitments,
  bytesToHex,
  commitmentsToVersionedHashes,
  getBlobs,
  hexToBytes
} from "@ethereumjs/util";
import * as console from "node:console";
import { BlobEIP4844Transaction } from "@ethereumjs/tx";
import { Chain, Common, Hardfork } from "@ethereumjs/common";


const main = async () => {
  const kzg = await loadKZG()

  let batcherAddress = '0xb79c84166a348b38894bafa95b4f8e286e325e1e';
  const txType: number = 2;

  const url = 'http://127.0.0.1:8000'; // Change the URL accordingly
  const rpc = "https://1rpc.io/sepolia"
  const web3 = new Web3(rpc);
  const provider = new ethers.JsonRpcProvider(rpc);

  let gasPrice = await web3.eth.getGasPrice()
  console.log("Gas price (gwei)", formatUnits(gasPrice, "gwei"))

  const chainId = await web3.eth.getChainId();
  let feeData = await provider.getFeeData();
  console.log("Fee Data:", feeData);

  let nonce = await provider.getTransactionCount(batcherAddress);
  console.log("Using nonce", nonce);

  const blobsData = ["abcd"]
  const blobs = getBlobs(blobsData.reduce((acc, cur) => acc + cur))
  const kzgCommitments = blobsToCommitments(kzg, blobs as Uint8Array[])
  const blobVersionedHashes = commitmentsToVersionedHashes(
    kzgCommitments as Uint8Array[]
  )

  const transactionArgs: TransactionArgs = {
    from: batcherAddress,
    to: batcherAddress,
    gas: "0x" + 21020n.toString(16),
    value: "0x" + 1n.toString(16),
    nonce: "0x" + nonce.toString(16),
    input: '0x',
    chainId: "0x" + chainId.toString(16),
  };

  if (txType == 3) {
    transactionArgs.blobVersionedHashes = blobVersionedHashes.map(bytesToHex)
    transactionArgs.maxFeePerBlobGas = "0x" + 2n.toString(16)
  }

  if (txType == 0) {
    transactionArgs.gasPrice = "0x" + gasPrice.toString(16);
  } else {
    transactionArgs.maxPriorityFeePerGas = "0x" + feeData.maxPriorityFeePerGas!.toString(16);
    transactionArgs.maxFeePerGas = "0x" + feeData.maxFeePerGas!.toString(16);
  }


  const response = await axios.post(url, {method: "eth_signTransaction", params: [transactionArgs]});
  let txResponse: TransactionResponse;

  if (txType == 3) {
    const common = new Common({
      chain: Chain.Sepolia,
      hardfork: Hardfork.Shanghai,
      eips: [4844],
      customCrypto: {kzg},
    })

    let signed = BlobEIP4844Transaction.fromSerializedTx(hexToBytes(response.data.result), {common});
    let copy = BlobEIP4844Transaction.fromTxData({...signed, blobsData, blobVersionedHashes: undefined}, {common});
    txResponse = await provider.broadcastTransaction(addHexPrefix(Buffer.from(copy.serializeNetworkWrapper()).toString('hex')));
  } else {
    txResponse = await provider.broadcastTransaction(response.data.result)
  }

  console.log(`Explorer link: https://sepolia.etherscan.io/tx/${txResponse.hash}`);
};

main();
