"use strict";

/**
 * Structured logger with global log-level filtering.
 * LOG_LEVEL can be: DEBUG, INFO, WARN, ERROR
 * Default = INFO (so DEBUG logs are hidden)
 */

const LOG_LEVEL = process.env.LOG_LEVEL || "INFO";
const LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"];

function shouldLog(level) {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(LOG_LEVEL);
}

function log(level, obj) {
  if (!shouldLog(level)) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    ...obj,
  };

  console.log(JSON.stringify(entry));
}

module.exports = {
  debug: (obj) => log("DEBUG", obj),
  info: (obj) => log("INFO", obj),
  warn: (obj) => log("WARN", obj),
  error: (obj) => log("ERROR", obj),
};
