module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "out"],
  globals: {
    "ts-jest": {
      tsConfig: {
        lib: ["esnext", "dom"],
        resolveJsonModule: true,
      },
    },
  },
};
