const path = require("path");

module.exports = {
  mode: "production",  // TODO: for debugging
  optimization: {minimize: false}, 
  entry: "./js/background.js", // Change this to your main script file
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
  },
  resolve: {
    fallback: {
      fs: false, // Prevents Webpack from trying to use Node.js modules
      path: false,
    },
  },
 devtool: 'source-map'  // we want a source-map to be present in /dist
};
