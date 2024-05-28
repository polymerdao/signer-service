import axios from 'axios';
import { TransactionArgs } from "./types";
import Web3 from "web3";
import { ethers, formatUnits, } from "ethers";
import { loadKZG } from "kzg-wasm";
import { Chain, Common, Hardfork } from "@ethereumjs/common";
import { BlobEIP4844Transaction } from "@ethereumjs/tx";
import * as console from "node:console";
import { bytesToHex } from "@ethereumjs/util";


const main = async () => {
  let address = '0xb05e516f04ac76e1ce7c4cbeeb2a34ed8728bb74';
  const txType: number = 0;
  const multiplierN = BigInt(10)
  const multiplierD = BigInt(10)

  const kzg = await loadKZG()

  const common = new Common({
    chain: Chain.Sepolia,
    hardfork: Hardfork.Shanghai,
    eips: [4844],
    customCrypto: {kzg},
  })

  const url = 'http://localhost:8000'; // Change the URL accordingly
  const rpc = "https://rpc.sepolia.org"
  const web3 = new Web3(rpc);
  const provider = new ethers.JsonRpcProvider(rpc);

  let gasPrice = (await web3.eth.getGasPrice()) * multiplierN / multiplierD;

  console.log("Gas price (gwei)", formatUnits(gasPrice, "gwei"))

  const chainId = await web3.eth.getChainId();
  let feeData = await provider.getFeeData();
  console.log("Fee Data:", feeData);

  let nonce = await provider.getTransactionCount(address);
  console.log("Using nonce", nonce);

  const transactionArgs: TransactionArgs = {
    from: address,
    to: address,
    gas: "0x" + 21000n.toString(16),
    value: "0x" + 1n.toString(16),
    nonce: "0x" + nonce.toString(16),
    input: '0x',
    blobVersionedHashes: [],
    chainId: "0x" + chainId.toString(16),
  };

  if (txType == 0) {
    transactionArgs.gasPrice = "0x" + gasPrice.toString(16);
  } else {
    transactionArgs.maxPriorityFeePerGas = "0x" + feeData.maxPriorityFeePerGas!.toString(16);
    transactionArgs.maxFeePerGas = "0x" + feeData.maxFeePerGas!.toString(16);
  }

  if (txType == 3) {
    const tx = BlobEIP4844Transaction.fromTxData({
      ...transactionArgs,
      gasPrice: undefined,
      blobsData: ['abcd'],
    }, {common})

    transactionArgs.blobVersionedHashes = tx.blobVersionedHashes.map(bytesToHex)
  }


  const response = await axios.post(url, {method: "eth_signTransaction", params: [transactionArgs]});
  const txResponse = await provider.broadcastTransaction(response.data.result)
  console.log(`Explorer link: https://sepolia.etherscan.io/tx/${txResponse.hash}`);
  // await txResponse.wait(1)
};

main();
