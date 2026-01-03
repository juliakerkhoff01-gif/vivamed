if (!Array.prototype.toReversed) {
  Object.defineProperty(Array.prototype, "toReversed", {
    value: function () { return [...this].reverse(); },
    enumerable: false,
  });
}
if (!Array.prototype.toSorted) {
  Object.defineProperty(Array.prototype, "toSorted", {
    value: function (compareFn) { return [...this].sort(compareFn); },
    enumerable: false,
  });
}
if (!Array.prototype.toSpliced) {
  Object.defineProperty(Array.prototype, "toSpliced", {
    value: function (start, deleteCount, ...items) {
      const copy = [...this];
      copy.splice(start, deleteCount, ...items);
      return copy;
    },
    enumerable: false,
  });
}
if (!Array.prototype.with) {
  Object.defineProperty(Array.prototype, "with", {
    value: function (index, value) {
      const copy = [...this];
      copy[index] = value;
      return copy;
    },
    enumerable: false,
  });
}
