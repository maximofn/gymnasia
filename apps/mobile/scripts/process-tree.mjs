import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

const managedTrees = new WeakSet();

export function spawnProcessTree(command, args, options = {}) {
  const child = spawn(command, args, {
    ...options,
    detached: process.platform !== "win32",
  });
  managedTrees.add(child);
  return child;
}

function isProcessTreeAlive(child) {
  if (!child || !managedTrees.has(child)) return false;
  if (process.platform === "win32") {
    return child.exitCode === null && child.signalCode === null;
  }
  if (!Number.isInteger(child.pid)) return false;
  try {
    process.kill(-child.pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    throw error;
  }
}

function signalProcessTree(child, signal) {
  if (!isProcessTreeAlive(child)) return;
  if (process.platform === "win32") {
    child.kill(signal);
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

async function waitForProcessTreeExit(child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (isProcessTreeAlive(child) && Date.now() < deadline) {
    await sleep(25);
  }
  return !isProcessTreeAlive(child);
}

export async function stopProcessTree(child, { graceMs = 5000 } = {}) {
  if (!child) return;
  signalProcessTree(child, "SIGINT");
  const stoppedGracefully = await waitForProcessTreeExit(child, graceMs);
  if (!stoppedGracefully) {
    signalProcessTree(child, "SIGKILL");
    await waitForProcessTreeExit(child, 1000);
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
}
