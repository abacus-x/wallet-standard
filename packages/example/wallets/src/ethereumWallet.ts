import {
    AllWalletAccountMethodNames,
    AllWalletAccountMethods,
    Bytes,
    CHAIN_ETHEREUM,
    CIPHER_DEFAULT,
    concatBytes,
    DecryptInput,
    DecryptOutput,
    EncryptInput,
    EncryptOutput,
    pick,
    SignAndSendTransactionInput,
    SignAndSendTransactionOutput,
    SignMessageInput,
    SignMessageOutput,
    SignTransactionInput,
    SignTransactionOutput,
    Wallet,
    WalletAccount,
    WalletAccountMethod,
} from '@solana/wallet-standard';
import ethers from 'ethers';
import { box, randomBytes } from 'tweetnacl';
import { AbstractWallet } from './abstractWallet';

export class EthereumWallet extends AbstractWallet<EthereumWalletAccount> implements Wallet<EthereumWalletAccount> {
    private _name: string = 'Ethereum Wallet';
    private _icon: string =
        'data:image/svg+xml;base64,PHN2ZyBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGZpbGwtcnVsZT0iZXZlbm9kZCIgaW1hZ2UtcmVuZGVyaW5nPSJvcHRpbWl6ZVF1YWxpdHkiIHNoYXBlLXJlbmRlcmluZz0iZ2VvbWV0cmljUHJlY2lzaW9uIiB0ZXh0LXJlbmRlcmluZz0iZ2VvbWV0cmljUHJlY2lzaW9uIiB2aWV3Qm94PSIwIDAgNzg0LjM3IDEyNzcuMzkiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbC1ydWxlPSJub256ZXJvIj48cGF0aCBkPSJtMzkyLjA3IDAtOC41NyAyOS4xMXY4NDQuNjNsOC41NyA4LjU1IDM5Mi4wNi0yMzEuNzV6IiBmaWxsPSIjMzQzNDM0Ii8+PHBhdGggZD0ibTM5Mi4wNyAwLTM5Mi4wNyA2NTAuNTQgMzkyLjA3IDIzMS43NXYtNDA5Ljk2eiIgZmlsbD0iIzhjOGM4YyIvPjxwYXRoIGQ9Im0zOTIuMDcgOTU2LjUyLTQuODMgNS44OXYzMDAuODdsNC44MyAxNC4xIDM5Mi4zLTU1Mi40OXoiIGZpbGw9IiMzYzNjM2IiLz48cGF0aCBkPSJtMzkyLjA3IDEyNzcuMzh2LTMyMC44NmwtMzkyLjA3LTIzMS42M3oiIGZpbGw9IiM4YzhjOGMiLz48cGF0aCBkPSJtMzkyLjA3IDg4Mi4yOSAzOTIuMDYtMjMxLjc1LTM5Mi4wNi0xNzguMjF6IiBmaWxsPSIjMTQxNDE0Ii8+PHBhdGggZD0ibTAgNjUwLjU0IDM5Mi4wNyAyMzEuNzV2LTQwOS45NnoiIGZpbGw9IiMzOTM5MzkiLz48L2c+PC9zdmc+';

    get name() {
        return this._name;
    }

    get icon() {
        return this._icon;
    }

    constructor() {
        super([new SignerEthereumWalletAccount({ chain: CHAIN_ETHEREUM })]);
    }
}

export type EthereumWalletChain = typeof CHAIN_ETHEREUM;

export type EthereumWalletAccount = SignerEthereumWalletAccount;

export class SignerEthereumWalletAccount implements WalletAccount {
    private _chain: string;
    private _methods: WalletAccountMethod<this>;
    private _wallet: ethers.Wallet;
    private _address: Bytes;
    private _publicKey: Bytes;
    private _secretKey: Bytes;

    get address() {
        return new Uint8Array(this._address);
    }

    get publicKey() {
        return new Uint8Array(this._publicKey);
    }

    get chain() {
        return this._chain;
    }

    get ciphers() {
        return [CIPHER_DEFAULT];
    }

    get methods(): WalletAccountMethod<this> {
        return { ...this._methods };
    }

    // FIXME: can't rely on private properties for access control
    private _allMethods: AllWalletAccountMethods<this> = {
        signTransaction: (...args) => this._signTransaction(...args),
        signAndSendTransaction: (...args) => this._signAndSendTransaction(...args),
        signMessage: (...args) => this._signMessage(...args),
        encrypt: (...args) => this._encrypt(...args),
        decrypt: (...args) => this._decrypt(...args),
    };

    constructor({
        chain,
        methods,
    }: {
        chain: EthereumWalletChain;
        methods?: AllWalletAccountMethodNames<SignerEthereumWalletAccount>[];
    }) {
        this._chain = chain;
        this._methods = methods ? pick(this._allMethods, ...methods) : this._allMethods;
        this._wallet = ethers.Wallet.createRandom();
        this._address = ethers.utils.arrayify(this._wallet.address);
        this._publicKey = ethers.utils.arrayify(this._wallet.publicKey);
        this._secretKey = ethers.utils.arrayify(this._wallet.privateKey);
    }

    private async _signTransaction(input: SignTransactionInput<this>): Promise<SignTransactionOutput<this>> {
        if (!('signTransaction' in this._methods)) throw new Error('unauthorized');
        if (input.extraSigners?.length) throw new Error('unsupported');

        const signedTransactions: Bytes[] = [];
        for (const rawTransaction of input.transactions) {
            const transaction = ethers.utils.parseTransaction(rawTransaction);

            const signedTransaction = await this._wallet.signTransaction({
                ...transaction,
                // HACK: signTransaction expects a `number` or `undefined`, not `null`
                type: transaction.type ?? undefined,
            });

            signedTransactions.push(ethers.utils.arrayify(signedTransaction));
        }
        return { signedTransactions };
    }

    private async _signAndSendTransaction(
        input: SignAndSendTransactionInput<this>
    ): Promise<SignAndSendTransactionOutput<this>> {
        if (!('signAndSendTransaction' in this._methods)) throw new Error('unauthorized');
        if (input.extraSigners?.length) throw new Error('unsupported');

        // homestead == Ethereum Mainnet
        const wallet = this._wallet.connect(ethers.getDefaultProvider('homestead'));

        const signatures: Bytes[] = [];
        for (const rawTransaction of input.transactions) {
            const transaction = ethers.utils.parseTransaction(rawTransaction);

            const { hash } = await wallet.sendTransaction({
                ...transaction,
                // HACK: signTransaction expects a `number` or `undefined`, not `null`
                type: transaction.type ?? undefined,
            });

            signatures.push(ethers.utils.arrayify(hash));
        }

        return { signatures };
    }

    private async _signMessage(input: SignMessageInput<this>): Promise<SignMessageOutput<this>> {
        if (!('signMessage' in this._methods)) throw new Error('unauthorized');
        if (input.extraSigners?.length) throw new Error('unsupported');

        const signedMessages: Bytes[] = [];
        for (const message of input.messages) {
            const signature = await this._wallet.signMessage(message);
            signedMessages.push(concatBytes(message, ethers.utils.arrayify(signature)));
        }

        return { signedMessages };
    }

    private async _encrypt(inputs: EncryptInput<this>[]): Promise<EncryptOutput<this>[]> {
        if (!('encrypt' in this._methods)) throw new Error('unauthorized');

        const outputs: EncryptOutput<this>[] = [];
        for (const { publicKey, cleartexts } of inputs) {
            const sharedKey = box.before(publicKey, this._secretKey);

            const nonces = [];
            const ciphertexts = [];
            for (let i = 0; i < cleartexts.length; i++) {
                nonces[i] = randomBytes(32);
                ciphertexts[i] = box.after(cleartexts[i], nonces[i], sharedKey);
            }

            outputs.push({ ciphertexts, nonces, cipher: CIPHER_DEFAULT });
        }

        return outputs;
    }

    private async _decrypt(inputs: DecryptInput<this>[]): Promise<DecryptOutput<this>[]> {
        if (!('decrypt' in this._methods)) throw new Error('unauthorized');

        const outputs: DecryptOutput<this>[] = [];
        for (const { publicKey, ciphertexts, nonces } of inputs) {
            const sharedKey = box.before(publicKey, this._secretKey);

            const cleartexts = [];
            for (let i = 0; i < cleartexts.length; i++) {
                const cleartext = box.open.after(ciphertexts[i], nonces[i], sharedKey);
                if (!cleartext) throw new Error('message authentication failed');
                cleartexts[i] = cleartext;
            }

            outputs.push({ cleartexts });
        }

        return outputs;
    }
}
