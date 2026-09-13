import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const read = (name) => readFileSync(new URL(`../../ops/android-build/${name}`, import.meta.url), "utf8");

test("la VM no usa Docker, mounts del host, GPU ni puertos reenviados", () => {
  const vm = read("start-vm.sh");
  assert.match(vm, /qemu-system-x86_64/);
  assert.match(vm, /-smp 4 -m 16384/);
  assert.match(vm, /-cpu host,-svm,-vmx/, "El guest no debe recibir virtualización anidada");
  assert.match(vm, /-netdev user,id=buildnet,ipv6=off/);
  assert.doesNotMatch(vm, /hostfwd|guestfwd|virtfs|virtiofs|9p|vfio|nvidia|docker|tap|bridge/);
  const unit = read("gymnasia-android-vm.service");
  for (const directive of ["User=gymnasia-vm", "NoNewPrivileges=yes", "ProtectHome=yes", "CPUQuota=400%", "MemoryMax=18G", "MemorySwapMax=0", "RuntimeMaxSec=2h", "DevicePolicy=closed"]) {
    assert.ok(unit.includes(directive), directive);
  }
  for (const range of ["10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "::/0"]) assert.ok(unit.includes(range));
  assert.match(unit, /ExecStopPost=\+\/usr\/local\/lib\/gymnasia-android\/clean-current.sh/);
  assert.doesNotMatch(unit, /^\[Install\]$/m);
});

test("instalar y hornear no registra ni activa el runner", () => {
  assert.doesNotMatch(read("install-host.sh"), /systemctl (?:enable|start)|config\.sh|--token/);
  assert.doesNotMatch(read("guest-install.sh"), /config\.sh|--token|systemctl (?:enable|start).*runner/);
  assert.match(read("guest-install.sh"), /apt-get purge --yes sudo openssh-server/);
  assert.match(read("gymnasia-runner.service"), /User=runner/);
  assert.match(read("gymnasia-runner.service"), /ExecStopPost=\+\/usr\/sbin\/poweroff/);
  assert.match(read("bake-image.sh"), /120G/);
});

test("el hook rechaza forks, PRs, workflows y jobs ajenos antes del checkout", () => {
  const hook = new URL("../../ops/android-build/admit-job.sh", import.meta.url).pathname;
  const base = {
    PATH: process.env.PATH, GITHUB_REPOSITORY: "maximofn/gymnasia", GITHUB_REF: "refs/heads/main",
    GITHUB_WORKFLOW_REF: "maximofn/gymnasia/.github/workflows/build-apk.yml@refs/heads/main",
    GITHUB_JOB: "compile-android", GITHUB_EVENT_NAME: "workflow_dispatch",
  };
  for (const [key, value] of [["GITHUB_REPOSITORY", "fork/gymnasia"], ["GITHUB_REF", "refs/pull/1/merge"], ["GITHUB_EVENT_NAME", "pull_request"], ["GITHUB_WORKFLOW_REF", "untrusted"], ["GITHUB_JOB", "another-job"]]) {
    assert.notEqual(spawnSync("bash", [hook], { env: { ...base, [key]: value } }).status, 0);
  }
});

test("cada descarga grande tiene URL concreta y SHA-256", () => {
  const downloads = JSON.parse(read("downloads.json"));
  for (const asset of Object.values(downloads)) {
    assert.match(asset.url, /^https:\/\//);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert.doesNotMatch(asset.url, /\/latest\//);
  }
});
