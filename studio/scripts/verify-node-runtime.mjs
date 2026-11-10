import {pathToFileURL} from "node:url";

// This runs BEFORE Expo export on CI and Vercel. A successful cloud build must
// prove which Node major actually executed, regardless of project settings.
export function assertStudioBuildNodeVersion(version) {
  if (typeof version !== "string" || !/^v?24\.\d+\.\d+$/.test(version)) {
    throw new Error("Studio Expo export requires Node.js 24.x; received " + String(version));
  }
  return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log("Studio Expo export verified Node.js runtime: " +
    assertStudioBuildNodeVersion(process.version));
}
