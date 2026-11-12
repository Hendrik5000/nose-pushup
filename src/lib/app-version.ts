import packageJson from "../../package.json";

// Keep the package semver canonical while displaying the user-selected 1.1 compactly.
export const ALO_APP_VERSION = packageJson.version.replace(/\.0$/, "");
