import { Signer } from "@web3-kms-signer/core";
import Web3 from "web3";
import { ethers, formatUnits } from "ethers";
import { KMSWallets } from "@web3-kms-signer/kms-wallets";
import { KMSProviderGCP } from "./KMSProviderGCP";

const rpc = process.env.RPC;
const provider = new ethers.JsonRpcProvider(rpc);
const web3 = new Web3(rpc);
let to = process.env.TO!
let PROJECT_ID = process.env.PROJECT_ID!
let LOCATION_ID = process.env.LOCATION_ID!
let keyRingId = process.env.KEY_RING_ID!
let keyId = process.env.KEY_ID!


if (require.main === module) {
  (async () => {
    const kmsProvider = new KMSProviderGCP({});
    const wallets = new KMSWallets(kmsProvider);

    kmsProvider.setPath({
      projectId: PROJECT_ID,
      locationId: LOCATION_ID,
      keyRingId: keyRingId
    });

    let kmsAddress = await wallets.getAddressHex(keyId)
    console.log("address", kmsAddress)

    let kmsNonce = await provider.getTransactionCount(kmsAddress);
    const chainId = await web3.eth.getChainId();

    const signer = new Signer(wallets, Number(chainId));

    let gasPrice = await web3.eth.getGasPrice()
    console.log("gas price (gwei)", formatUnits(gasPrice, "gwei"))

    const txData = {
      nonce: kmsNonce,
      gasPrice: gasPrice,
      gasLimit: 21000,
      to: to,
      value: ethers.parseEther("0.0001"),
      data: '0x',
      chainId: chainId,
    };

    const signedTx = await signer.signTransaction({keyId: keyId}, txData);
    console.log("signedTx", signedTx)

    const tx = await provider.broadcastTransaction(signedTx)
    console.log(`https://sepolia.etherscan.io/tx/${tx.hash}`);

    const receipt = await tx.wait(1)
    console.log("receipt", receipt)
  })();
}