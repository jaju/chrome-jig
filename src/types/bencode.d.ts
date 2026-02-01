declare module 'bencode' {
  const bencode: {
    encode(data: unknown): Uint8Array;
    decode(data: Uint8Array | Buffer): unknown;
  };
  export default bencode;
}
