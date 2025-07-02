declare module 'ntp-client' {
  interface NTPData {
    t1: Date;
    t2: Date;
    t3: Date;
    t4: Date;
  }

  function getNetworkTime(
    server: string,
    port: number,
    callback: (err: Error | null, date?: Date, info?: NTPData) => void
  ): void;

  export { getNetworkTime };
} 