// Vitest resolve configuration
// This file resolves patterns for Vitest to better match Node.js module resolution

export default {
  "resolve": {
    "alias": {
      "@": "./src/app/components"
    },
    "extensions": [".js", ".ts", ".tsx", ".jsx"]
  }
};