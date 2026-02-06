export const useDomListener = (
  selector: string,
  onFound: (el: Element) => void,
) => {
  const existing = document.querySelector(selector);
  if (existing) {
    onFound(existing);
    return () => undefined;
  }

  const observer = new MutationObserver(() => {
    const el = document.querySelector(selector);
    if (!el) return;
    onFound(el);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
};
