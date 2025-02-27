/**
 * The following methods are based on `ethereumjs/tx`, thanks for their work
 * https://github.com/ethereumjs/ethereumjs-monorepo/tree/master/packages/tx
 * Distributed under the Mozilla Public License Version 2.0 software license, see the accompanying
 * file LICENSE or https://opensource.org/license/mpl-2-0/.
 */

import {
  bnToHex,
  bnToUnpaddedBuffer,
  keccak256,
  MAX_INTEGER,
  rlp,
  toBuffer,
  toType,
  TypeOutput,
  validateNoLeadingZeroes,
} from "../ethereumjs-util";

import { BN } from "@web3jskit/crypto-lib";

import { BaseTransaction } from "./baseTransaction";
import {
  AccessList,
  AccessListBuffer,
  FeeMarketEIP1559TxData,
  FeeMarketEIP1559ValuesArray,
  JsonTx,
} from "./types";
import { AccessLists } from "./util";

const TRANSACTION_TYPE = 2;
const TRANSACTION_TYPE_BUFFER = Buffer.from(
  TRANSACTION_TYPE.toString(16).padStart(2, "0"),
  "hex"
);

/**
 * Typed transaction with a new gas fee market mechanism
 *
 * - TransactionType: 2
 * - EIP: [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559)
 */
export default class FeeMarketEIP1559Transaction extends BaseTransaction<FeeMarketEIP1559Transaction> {
  public readonly chainId: BN;
  public readonly accessList: AccessListBuffer;
  public readonly AccessListJSON: AccessList;
  public readonly maxPriorityFeePerGas: BN;
  public readonly maxFeePerGas: BN;

  /**
   * Instantiate a transaction from a data dictionary.
   *
   * Format: { chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data,
   * accessList, v, r, s }
   *
   * Notes:
   * - `chainId` will be set automatically if not provided
   * - All parameters are optional and have some basic default values
   */
  public static fromTxData(txData: FeeMarketEIP1559TxData) {
    return new FeeMarketEIP1559Transaction(txData);
  }

  /**
   * Instantiate a transaction from the serialized tx.
   *
   * Format: `0x02 || rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data,
   * accessList, signatureYParity, signatureR, signatureS])`
   */
  public static fromSerializedTx(serialized: Buffer) {
    if (!serialized.slice(0, 1).equals(TRANSACTION_TYPE_BUFFER)) {
      throw new Error(
        `Invalid serialized tx input: not an EIP-1559 transaction (wrong tx type, expected: ${TRANSACTION_TYPE}, received: ${serialized
          .slice(0, 1)
          .toString("hex")}`
      );
    }

    const values = rlp.decode(serialized.slice(1));

    if (!Array.isArray(values)) {
      throw new Error("Invalid serialized tx input: must be array");
    }

    return FeeMarketEIP1559Transaction.fromValuesArray(values as any);
  }

  /**
   * Create a transaction from a values array.
   *
   * Format: `[chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data,
   * accessList, signatureYParity, signatureR, signatureS]`
   */
  public static fromValuesArray(values: FeeMarketEIP1559ValuesArray) {
    if (values.length !== 9 && values.length !== 12) {
      throw new Error(
        "Invalid EIP-1559 transaction. Only expecting 9 values (for unsigned tx) or 12 values (for signed tx)."
      );
    }

    const [
      chainId,
      nonce,
      maxPriorityFeePerGas,
      maxFeePerGas,
      gasLimit,
      to,
      value,
      data,
      accessList,
      v,
      r,
      s,
    ] = values;

    validateNoLeadingZeroes({
      nonce,
      maxPriorityFeePerGas,
      maxFeePerGas,
      gasLimit,
      value,
      v,
      r,
      s,
    });

    return new FeeMarketEIP1559Transaction({
      chainId: new BN(chainId),
      nonce,
      maxPriorityFeePerGas,
      maxFeePerGas,
      gasLimit,
      to,
      value,
      data,
      accessList: accessList ?? [],
      v: v !== undefined ? new BN(v) : undefined, // EIP2930 supports v's with value 0 (empty Buffer)
      r,
      s,
    });
  }

  /**
   * This constructor takes the values, validates them, assigns them and freezes the object.
   *
   * It is not recommended to use this constructor directly. Instead use
   * the static factory methods to assist in creating a Transaction object from
   * varying data types.
   */
  public constructor(txData: FeeMarketEIP1559TxData) {
    super({ ...txData, type: TRANSACTION_TYPE });
    const { chainId, accessList, maxFeePerGas, maxPriorityFeePerGas } = txData;

    this.chainId = toType(chainId, TypeOutput.BN);

    this.activeCapabilities = this.activeCapabilities.concat([
      1559, 2718, 2930,
    ]);

    // Populate the access list fields
    const accessListData = AccessLists.getAccessListData(accessList ?? []);
    this.accessList = accessListData.accessList;
    this.AccessListJSON = accessListData.AccessListJSON;
    // Verify the access list format.
    AccessLists.verifyAccessList(this.accessList);

    this.maxFeePerGas = new BN(
      toBuffer(maxFeePerGas === "" ? "0x" : maxFeePerGas)
    );
    this.maxPriorityFeePerGas = new BN(
      toBuffer(maxPriorityFeePerGas === "" ? "0x" : maxPriorityFeePerGas)
    );

    this._validateCannotExceedMaxInteger({
      maxFeePerGas: this.maxFeePerGas,
      maxPriorityFeePerGas: this.maxPriorityFeePerGas,
    });

    if (this.gasLimit.mul(this.maxFeePerGas).gt(MAX_INTEGER)) {
      const msg = this._errorMsg(
        "gasLimit * maxFeePerGas cannot exceed MAX_INTEGER (2^256-1)"
      );
      throw new Error(msg);
    }

    if (this.maxFeePerGas.lt(this.maxPriorityFeePerGas)) {
      const msg = this._errorMsg(
        "maxFeePerGas cannot be less than maxPriorityFeePerGas (The total must be the larger of the two)"
      );
      throw new Error(msg);
    }

    if (this.v && !this.v.eqn(0) && !this.v.eqn(1)) {
      const msg = this._errorMsg(
        "The y-parity of the transaction should either be 0 or 1"
      );
      throw new Error(msg);
    }
  }

  /**
   * Returns a Buffer Array of the raw Buffers of the EIP-1559 transaction, in order.
   *
   * Format: `[chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data,
   * accessList, signatureYParity, signatureR, signatureS]`
   *
   * Use {@link FeeMarketEIP1559Transaction.serialize} to add a transaction to a block
   * with {@link Block.fromValuesArray}.
   *
   * For an unsigned tx this method uses the empty Buffer values for the
   * signature parameters `v`, `r` and `s` for encoding. For an EIP-155 compliant
   * representation for external signing use {@link FeeMarketEIP1559Transaction.getMessageToSign}.
   */
  raw(): FeeMarketEIP1559ValuesArray {
    return [
      bnToUnpaddedBuffer(this.chainId),
      bnToUnpaddedBuffer(this.nonce),
      bnToUnpaddedBuffer(this.maxPriorityFeePerGas),
      bnToUnpaddedBuffer(this.maxFeePerGas),
      bnToUnpaddedBuffer(this.gasLimit),
      this.to !== undefined ? this.to.buf : Buffer.from([]),
      bnToUnpaddedBuffer(this.value),
      this.data,
      this.accessList,
      this.v !== undefined ? bnToUnpaddedBuffer(this.v) : Buffer.from([]),
      this.r !== undefined ? bnToUnpaddedBuffer(this.r) : Buffer.from([]),
      this.s !== undefined ? bnToUnpaddedBuffer(this.s) : Buffer.from([]),
    ];
  }

  /**
   * Returns the serialized encoding of the EIP-1559 transaction.
   *
   * Format: `0x02 || rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data,
   * accessList, signatureYParity, signatureR, signatureS])`
   *
   * Note that in contrast to the legacy tx serialization format this is not
   * valid RLP any more due to the raw tx type preceding and concatenated to
   * the RLP encoding of the values.
   */
  serialize(): Buffer {
    const base = this.raw();
    return Buffer.concat([TRANSACTION_TYPE_BUFFER, rlp.encode(base as any)]);
  }

  /**
   * Returns the serialized unsigned tx (hashed or raw), which can be used
   * to sign the transaction (e.g. for sending to a hardware wallet).
   *
   * Note: in contrast to the legacy tx the raw message format is already
   * serialized and doesn't need to be RLP encoded any more.
   *
   * ```javascript
   * const serializedMessage = tx.getMessageToSign(false) // use this for the HW wallet input
   * ```
   *
   * @param hashMessage - Return hashed message if set to true (default: true)
   */
  getMessageToSign(hashMessage = true): Buffer {
    const base = this.raw().slice(0, 9);
    const message = Buffer.concat([
      TRANSACTION_TYPE_BUFFER,
      rlp.encode(base as any),
    ]);
    if (hashMessage) {
      return keccak256(message);
    } else {
      return message;
    }
  }

  /**
   * Computes a sha3-256 hash of the serialized tx.
   *
   * This method can only be used for signed txs (it throws otherwise).
   * Use {@link FeeMarketEIP1559Transaction.getMessageToSign} to get a tx hash for the purpose of signing.
   */
  public hash(): Buffer {
    if (!this.isSigned()) {
      const msg = this._errorMsg(
        "Cannot call hash method if transaction is not signed"
      );
      throw new Error(msg);
    }
    return keccak256(this.serialize());
  }

  _processSignature(v: number, r: Buffer, s: Buffer) {
    return FeeMarketEIP1559Transaction.fromTxData({
      chainId: this.chainId,
      nonce: this.nonce,
      maxPriorityFeePerGas: this.maxPriorityFeePerGas,
      maxFeePerGas: this.maxFeePerGas,
      gasLimit: this.gasLimit,
      to: this.to,
      value: this.value,
      data: this.data,
      accessList: this.accessList,
      v: new BN(v - 27), // This looks extremely hacky: ethereumjs-util actually adds 27 to the value, the recovery bit is either 0 or 1.
      r: new BN(r),
      s: new BN(s),
    });
  }

  _processSignatureWithRawV(v: number, r: Buffer, s: Buffer) {
    return FeeMarketEIP1559Transaction.fromTxData({
      chainId: this.chainId,
      nonce: this.nonce,
      maxPriorityFeePerGas: this.maxPriorityFeePerGas,
      maxFeePerGas: this.maxFeePerGas,
      gasLimit: this.gasLimit,
      to: this.to,
      value: this.value,
      data: this.data,
      accessList: this.accessList,
      v: new BN(v), // This looks extremely hacky: ethereumjs-util actually adds 27 to the value, the recovery bit is either 0 or 1.
      r: new BN(r),
      s: new BN(s),
    });
  }

  /**
   * Returns an object with the JSON representation of the transaction
   */
  toJSON(): JsonTx {
    const accessListJSON = AccessLists.getAccessListJSON(this.accessList);

    return {
      chainId: bnToHex(this.chainId),
      nonce: bnToHex(this.nonce),
      maxPriorityFeePerGas: bnToHex(this.maxPriorityFeePerGas),
      maxFeePerGas: bnToHex(this.maxFeePerGas),
      gasLimit: bnToHex(this.gasLimit),
      to: this.to !== undefined ? this.to.toString() : undefined,
      value: bnToHex(this.value),
      data: "0x" + this.data.toString("hex"),
      accessList: accessListJSON,
      v: this.v !== undefined ? bnToHex(this.v) : undefined,
      r: this.r !== undefined ? bnToHex(this.r) : undefined,
      s: this.s !== undefined ? bnToHex(this.s) : undefined,
    };
  }

  /**
   * Return a compact error string representation of the object
   */
  public errorStr() {
    let errorStr = this._getSharedErrorPostfix();
    errorStr += ` maxFeePerGas=${this.maxFeePerGas} maxPriorityFeePerGas=${this.maxPriorityFeePerGas}`;
    return errorStr;
  }

  /**
   * Internal helper function to create an annotated error message
   *
   * @param msg Base error message
   * @hidden
   */
  protected _errorMsg(msg: string) {
    return `${msg} (${this.errorStr()})`;
  }
}
