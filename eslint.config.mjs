import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";


export default defineConfig ( [
  { files: ["**/*.{js,mjs,cjs}"], 
    languageOptions: { globals: {...globals.browser, chrome:"readonly"}, ecmaVersion: 12, sourceType: 'module'  },  
    plugins: { js },
    extends: ["js/recommended"] },
   { ignores: ["node_modules/", "dist/", "manifest.json", "deprecated/", "webpack.config.js"]},
/*env: {
    browser: true,         // Use the browser environment
    es2021: true,          // Use ECMAScript 2021 features
    chrome: true,          // Enable Chrome-specific global variables
  },
*/
 /* { env: { browser: true, webextensions: true, es2021: true } }, 
/*    extends: ['eslint:recommended', 'prettier'],
    rules: {
      'no-unused-vars': 'warn',
      'no-console':     'off',
      'semi':           ['error', 'always'],
    },
  }
*/
] );