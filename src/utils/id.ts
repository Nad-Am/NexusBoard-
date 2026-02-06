export const createId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  const rand = Math.random().toString(36).slice(2);
  return `${prefix}_${Date.now()}_${rand}`;
};
