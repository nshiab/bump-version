import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { execSync } from "node:child_process";

export function bumpVersion(incrementType: string) {
  // 1. Check if we are on the main branch
  let branch;
  try {
    branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
    }).trim();
  } catch (_e) {
    throw new Error(
      "Failed to get current branch. Is this a git repository?",
    );
  }

  if (branch.startsWith("heads/")) {
    branch = branch.slice(6);
  }
  if (branch !== "main") {
    throw new Error(
      `You can only increment the version on the main branch. Current branch is ${branch}`,
    );
  }

  // 2. Read both configuration files strictly
  const denoJsonPath = "deno.json";
  const packageJsonPath = "package.json";

  let denoData, packageData;

  try {
    denoData = JSON.parse(readFileSync(denoJsonPath, "utf-8"));
  } catch (_e) {
    throw new Error(
      `Could not read ${denoJsonPath}. This is required for JSR.`,
    );
  }

  try {
    packageData = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  } catch (_e) {
    console.log(`${packageJsonPath} not found, skipping.`);
  }

  if (!denoData.version) throw new Error("No version found in deno.json");

  // 3. Calculate the new version (using deno.json as the source of truth for the calculation)
  const versionParts = denoData.version.split(".").map((d: string) =>
    parseInt(d)
  );

  if (versionParts.length !== 3 || versionParts.some(isNaN)) {
    throw new Error(
      `Invalid version format in deno.json: ${denoData.version}`,
    );
  }

  if (incrementType === "major") {
    versionParts[0] += 1;
    versionParts[1] = 0;
    versionParts[2] = 0;
  } else if (incrementType === "minor") {
    versionParts[1] += 1;
    versionParts[2] = 0;
  } else if (incrementType === "patch") {
    versionParts[2] += 1;
  } else {
    throw new Error(
      "Invalid increment type. Use 'major', 'minor', or 'patch'.",
    );
  }

  const newVersion = versionParts.join(".");

  // 4. Apply the new version to both files
  denoData.version = newVersion;
  writeFileSync(denoJsonPath, JSON.stringify(denoData, null, 2) + "\n");

  if (packageData) {
    packageData.version = newVersion;
    writeFileSync(packageJsonPath, JSON.stringify(packageData, null, 2) + "\n");
    console.log(`Updated deno.json and package.json to version ${newVersion}`);
  } else {
    console.log(`Updated deno.json to version ${newVersion}`);
  }

  // 5. Format, commit, push, and tag
  try {
    execSync("deno fmt");
  } catch (_e) {
    console.warn(
      "Warning: `deno fmt` failed or is not installed. Skipping formatting.",
    );
  }

  execSync("git add -A");
  execSync(`git commit -m "v${newVersion}"`);
  execSync("git push");

  const tagName = `v${newVersion}`;
  execSync(`git tag ${tagName}`);
  execSync(`git push origin tag ${tagName}`);

  console.log(`Successfully committed, pushed, and tagged with ${tagName}`);
}

// Only run automatically if invoked directly from the CLI
if (import.meta.main) {
  const args = process.argv.slice(2);
  const [incrementType] = args;

  if (!incrementType) {
    console.error(
      "Please provide an increment type: 'major', 'minor', or 'patch'.",
    );
    process.exit(1);
  }

  bumpVersion(incrementType);
}
