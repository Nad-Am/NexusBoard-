type CryptoLike = {
  randomUUID?: () => string;
};

const fallbackId = () => {
  const time = Date.now().toString(16);
  const rand = Math.random().toString(16).slice(2);
  return `${time}${rand}`;
};

export const createId = (prefix?: string) => {
  const cryptoRef = (globalThis as { crypto?: CryptoLike }).crypto;
  const base = cryptoRef?.randomUUID ? cryptoRef.randomUUID() : fallbackId();
  return prefix ? `${prefix}-${base}` : base;
};

export const createShortId = (length = 8) => {
  const base = createId().replace(/-/g, "");
  return base.slice(0, length);
};
