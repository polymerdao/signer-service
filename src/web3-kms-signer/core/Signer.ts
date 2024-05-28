import {
    addHexPrefix,
    fromSigned,
    toUnsigned,
    hashPersonalMessage,
    bigIntToBytes
} from '@ethereumjs/util'
import { TypedTxData } from '@ethereumjs/tx';
import { Common } from '@ethereumjs/common'
import { Wallets } from './Wallets';
import { UBuffer } from './Utils/UBuffer';
import { TransactionFactory } from "@ethereumjs/tx";
import { CustomCrypto } from "@ethereumjs/common";

/**
 * The Signer class provides functionality to sign Ethereum transactions and messages using
 * private keys managed by a specified Wallets instance. It supports signing arbitrary messages,
 * hashed digests, and transaction data, preparing them for blockchain submission. The class
 * can be configured with a specific blockchain network through an optional chain ID, allowing
 * it to sign transactions according to network-specific parameters. It abstracts the complexities
 * of transaction serialization and signature generation, streamlining the process of creating
 * secure and valid blockchain transactions.
 * 
 */
export class Signer {
    wallets: Wallets;
    common?: Common;

    /**
     * Constructs a Signer instance with a specified Wallets instance and an optional chain ID.
     * The chain ID is used to configure the network for transactions.
     * @param wallets An instance of Wallets for key management and signing.
     * @param chainId Optional chain ID to specify the blockchain network.
     * @param eips Optional array of EIPs to enable for the transaction.
     * @param customCrypto Optional custom crypto object to use for hashing and signing.
     */
    constructor(wallets: Wallets, chainId?: number, eips?: number[], customCrypto?: CustomCrypto) {
        this.wallets = wallets;
        this.common = (chainId) ? Common.custom({ chainId: chainId, networkId: chainId }, {eips, customCrypto}) : undefined;
    }

    /**
     * Signs an Ethereum transaction with the specified account's.
     * @param account An object containing the keyId and optional address of the signing account.
     * @param txData The transaction data to sign.
     * @returns A Promise that resolves to the serialized transaction as a '0x'-prefixed hex string.
     */
    public async signTransaction(account: { keyId: string, address?: Buffer }, txData: TypedTxData) {
        let tx = TransactionFactory.fromTxData(txData, { common: this.common });
        const digest     =  Buffer.from(tx.getHashedMessageToSign())

        const {r, s, v}  = await this.wallets.ecsign(account, digest, tx.type, this.common?.chainId());
        const signed     = TransactionFactory.fromTxData({...txData, r, s, v}, { common: this.common });
        return addHexPrefix(Buffer.from(signed.serialize()).toString('hex'));
    }

    /**
     * Signs an arbitrary message using the specified account's. The message is first
     * hashed and then signed.
     * @param account An object containing the keyId and optional address of the signing account.
     * @param message The message to sign.
     * @returns A Promise that resolves to the '0x'-prefixed hex string of the signature.
     */
    public async signMessage(account: { keyId: string, address?: Buffer }, message: string) {
        const digest = hashPersonalMessage(Buffer.from(message));
        return this.signDigest(account, Buffer.from(digest));
    }

    /**
     * Signs a digest (hashed message) using the specified account's.
     * @param account An object containing the keyId and optional address of the signing account.
     * @param digest The digest to sign, either as a Buffer or a '0x'-prefixed hex string.
     * @returns A Promise that resolves to the '0x'-prefixed hex string of the signature.
     */
    public async signDigest(account: { keyId: string, address?: Buffer }, digest: string | Buffer) {
        const {r, s, v} = await this.wallets.ecsign(account, UBuffer.bufferOrHex(digest));

        const rStr = Buffer.from(toUnsigned(fromSigned(r))).toString('hex');
        const sStr = Buffer.from(toUnsigned(fromSigned(s))).toString('hex');
        const vStr = Buffer.from(bigIntToBytes(v)).toString('hex');

        return addHexPrefix(rStr.concat(sStr, vStr));
    }
}