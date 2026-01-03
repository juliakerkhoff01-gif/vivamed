/**
 * Polyfill for Array.prototype.toReversed() (ES2023)
 * Needed for some Metro/Expo versions when running on Node 18.
 */
(() => {
  if (!Array.prototype.toReversed) {
    Object.defineProperty(Array.prototype, "toReversed", {
      value: function toReversed() {
        // copy first, then reverse (does not mutate original)
        return Array.prototype.slice.call(this).reverse();
      },
      writable: true,
      configurable: true,
    });
  }
})();
