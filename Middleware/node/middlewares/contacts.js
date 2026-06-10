"use strict";

/*
  Minimal helper used by BrandViewService for error formatting.
  The real project may have a richer contacts module; this stub provides fullError().
*/

function fullError(err) {
  if (!err) return null;
  try {
    if (err.response && err.response.data) return JSON.stringify(err.response.data);
    if (err.stack) return err.stack;
    return String(err);
  } catch (e) {
    return String(err);
  }
}

module.exports = { fullError };
