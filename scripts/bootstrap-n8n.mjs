import { execSync } from "node:child_process";
import path from "node:path";

const workflowId = "redditpulse-manual-run";
const workflowName = "RedditPulse";
const workflowFile = path.resolve(
  process.cwd(),
  "n8n",
  "workflows",
  "redditpulse-manual-run.json",
);
const localWebhookUrl = "http://localhost:5678/webhook/redditpulse-manual";

function runN8n(args) {
  const command = ["n8n", ...args.map((arg) => `"${arg}"`)].join(" ");

  return execSync(command, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
}

function runPowerShell(command) {
  return execSync(`powershell -NoProfile -Command "${command}"`, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  }).trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForN8n(baseUrl, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });

      if (response.ok || response.status === 302 || response.status === 401) {
        return;
      }
    } catch {}

    await sleep(1000);
  }

  throw new Error(`Timed out waiting for n8n at ${baseUrl}`);
}

async function restartN8n() {
  const existingPid = runPowerShell(
    "$connection = Get-NetTCPConnection -LocalPort 5678 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($connection) { $connection.OwningProcess }",
  );

  if (existingPid) {
    runPowerShell(`Stop-Process -Id ${existingPid} -Force`);
    await sleep(1500);
  }

  const n8nExecutable = runPowerShell("(where.exe n8n | Select-Object -First 1)");

  if (!n8nExecutable) {
    throw new Error("Unable to locate the n8n executable on PATH.");
  }

  runPowerShell(
    `Start-Process -FilePath '${n8nExecutable.replace(/'/g, "''")}' -ArgumentList 'start','-o' -WindowStyle Hidden`,
  );

  await waitForN8n("http://localhost:5678");
}

try {
  const workflows = runN8n(["list:workflow"]);

  if (workflows.includes(`${workflowId}|`)) {
    console.log(`Found existing ${workflowName} (${workflowId}). Re-importing to update it.`);
  } else {
    console.log(`No existing ${workflowName} (${workflowId}) found. Importing it now.`);
  }

  runN8n(["import:workflow", `--input=${workflowFile}`]);
  console.log(`Imported ${workflowName} (${workflowId}).`);

  runN8n(["publish:workflow", `--id=${workflowId}`]);
  console.log(`Published ${workflowName} (${workflowId}).`);
  await restartN8n();
  console.log("Restarted local n8n so the production webhook registration is fresh.");
  console.log(`Use this webhook in RedditPulse: ${localWebhookUrl}`);
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown n8n bootstrap failure.";
  console.error(message);
  process.exitCode = 1;
}
