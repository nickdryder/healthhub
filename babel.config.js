module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      "react-native-reanimated/plugin",
      "react-native-worklets/plugin",
      "@babel/plugin-proposal-export-namespace-from",
    ],
  };
};
