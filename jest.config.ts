import type { Config } from "@jest/types";

export default async (): Promise<Config.InitialOptions> => {
  return {
    preset: "ts-jest",
    testEnvironment: "node",
    verbose: true,
    clearMocks: true,
    moduleFileExtensions: ["js", "ts"],
    testMatch: ["**/*.test.ts"],
    transform: {
      "^.+\\.ts$": "ts-jest",
    },
  };
};
