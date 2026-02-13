export default {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.jest.json",
        useESM: true,
      },
    ],
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.spec.{ts,tsx}",
    "!src/**/index.ts",
  ],
  moduleNameMapper: {
    "\\.(css|less|sass|scss)$": "identity-obj-proxy",
    "^.+\\.svg$": "jest-transformer-svg",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  coveragePathIgnorePatterns: [
    "<rootDir>/src/main.ts",
    "vite-env.d.ts",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};
