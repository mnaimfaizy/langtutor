const Module = require("node:module");
const path = require("node:path");

const originalResolve = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "next/dist/compiled/babel/eslint-parser") {
    return path.join(__dirname, "../node_modules/next/dist/compiled/babel/eslint-parser.js");
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
