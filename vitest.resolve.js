// Vitest resolve configuration
// This file resolves patterns for Vitest to better match Node.js module resolution

const vitestResolveConfig = {
  "resolve": {
    "alias": {
      "@": "./src/app/components"
    },
    "extensions": [".js", ".ts", ".tsx", ".jsx"]
  }
};

export default vitestResolveConfig;