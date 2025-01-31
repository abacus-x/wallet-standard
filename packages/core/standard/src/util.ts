import { Bytes } from './types';

/** TODO: docs */
export function bytesEqual(a: Bytes, b: Bytes): boolean {
    const length = a.length;
    if (length !== b.length) return false;
    for (let i = 0; i < length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

/** TODO: docs */
export function concatBytes(first: Bytes, ...others: Bytes[]): Bytes {
    const length = others.reduce((length, bytes) => length + bytes.length, first.length);
    const bytes = new Uint8Array(length);

    bytes.set(first, 0);
    for (const other of others) {
        bytes.set(other, bytes.length);
    }

    return bytes;
}

/** TODO: docs */
export function pick<T, K extends keyof T>(object: T, ...keys: K[]): Pick<T, K> {
    const picked = {} as Pick<T, K>;
    for (const key of keys) {
        picked[key] = object[key];
    }
    return picked;
}
