import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
export default function config(phase: string): NextConfig {
  return {
    distDir:
      process.env.CALLFLOW_AUTH_TEST_SERVER === "1"
        ? ".next-auth-test"
        : phase === PHASE_DEVELOPMENT_SERVER
          ? process.env.CALLFLOW_TEST_SERVER === "1" ||
            process.env.CALLFLOW_CLOUD_TEST_SERVER === "1"
            ? process.env.CALLFLOW_CLOUD_TEST_SERVER === "1"
              ? ".next-cloud-test"
              : ".next-test"
            : ".next-dev"
          : ".next",
    devIndicators: false,
  };
}
