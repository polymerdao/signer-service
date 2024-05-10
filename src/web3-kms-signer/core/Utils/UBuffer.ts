export class UBuffer {
    public static bufferOrHex(input: Buffer | string) {
        return (input instanceof Buffer) ? input : Buffer.from(input.replace('0x', ''), 'hex');
    }

    public static  bufferToHex = function (buf: Buffer): string {
        return '0x' + buf.toString('hex')
    }
}