#!/usr/bin/env node

import { constants as fsConstants } from "node:fs";
import { readFileSync } from "node:fs";
import { access, chmod, open, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  decryptPortablePayload,
  encryptedPortableMaximumFileBytes,
  type PortableByteSource,
} from "../apps/mobile/backup/portableEncryption";

type CliOptions = {
  input: string;
  output: string;
  passwordStdin: boolean;
};

function usage(): string {
  return [
    "Uso:",
    "  npm run decrypt:recovery -- --input <archivo.gymnasia> --output <destino.json>",
    "",
    "La contraseña se solicita sin mostrarla. --password-stdin está reservado para pruebas automatizadas.",
  ].join("\n");
}

function parseArgs(argv: string[]): CliOptions {
  let input = "";
  let output = "";
  let passwordStdin = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--input") input = argv[++index] ?? "";
    else if (argument === "--output") output = argv[++index] ?? "";
    else if (argument === "--password-stdin") passwordStdin = true;
    else if (argument === "--help" || argument === "-h") {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    } else {
      throw new Error(`Argumento desconocido: ${argument}\n\n${usage()}`);
    }
  }
  if (!input || !output) throw new Error(usage());
  return { input: resolve(input), output: resolve(output), passwordStdin };
}

async function readPasswordWithoutEcho(): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("No hay un terminal interactivo para solicitar la contraseña.");
  }
  process.stderr.write("Contraseña de la copia: ");
  process.stdin.setRawMode(true);
  process.stdin.setEncoding("utf8");
  process.stdin.resume();
  return new Promise((resolvePassword, reject) => {
    let password = "";
    const finish = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stderr.write("\n");
      resolvePassword(password);
    };
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          process.stdin.off("data", onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stderr.write("\n");
          reject(new Error("Operación cancelada."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          password = [...password].slice(0, -1).join("");
        } else {
          password += character;
        }
      }
    };
    process.stdin.on("data", onData);
  });
}

async function readPassword(passwordStdin: boolean): Promise<string> {
  if (!passwordStdin) return readPasswordWithoutEcho();
  const input = readFileSync(0, "utf8");
  return input.replace(/\r?\n$/, "");
}

function validateRecoveryPayload(plaintext: Uint8Array): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plaintext));
  } catch {
    throw new Error("El contenido descifrado no es JSON de recuperación válido.");
  }
  if (
    !parsed
    || typeof parsed !== "object"
    || Array.isArray(parsed)
    || (parsed as Record<string, unknown>).app !== "gymnasia"
    || (parsed as Record<string, unknown>).type !== "local-store-recovery"
    || (parsed as Record<string, unknown>).schemaVersion !== 1
    || !(parsed as Record<string, unknown>).recovery
  ) {
    throw new Error("El archivo no contiene una exportación de recuperación de Gymnasia.");
  }
}

export async function runRecoveryDecrypt(argv: string[]): Promise<void> {
  const options = parseArgs(argv);
  if (options.input === options.output) throw new Error("La entrada y la salida deben ser archivos distintos.");
  try {
    await access(options.output, fsConstants.F_OK);
    throw new Error("El archivo de salida ya existe; no se sobrescribirá.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const inputInfo = await stat(options.input);
  if (!inputInfo.isFile()) throw new Error("La entrada no es un archivo.");
  if (inputInfo.size > encryptedPortableMaximumFileBytes()) {
    throw new Error("El archivo cifrado supera el tamaño máximo permitido.");
  }
  const input = await open(options.input, "r");
  let plaintext: Uint8Array | null = null;
  try {
    const source: PortableByteSource = {
      size: inputInfo.size,
      async read(offset, length) {
        const target = new Uint8Array(length);
        const result = await input.read(target, 0, length, offset);
        return target.subarray(0, result.bytesRead);
      },
    };
    const password = await readPassword(options.passwordStdin);
    plaintext = await decryptPortablePayload(source, password);
    validateRecoveryPayload(plaintext);
    const output = await open(options.output, "wx", 0o600);
    let outputClosed = false;
    try {
      await output.writeFile(plaintext);
      await output.close();
      outputClosed = true;
      await chmod(options.output, 0o600);
    } catch (error) {
      if (!outputClosed) await output.close().catch(() => undefined);
      await rm(options.output, { force: true });
      throw error;
    }
    process.stderr.write(`Recuperación descifrada en ${options.output} (permisos 0600).\n`);
  } finally {
    plaintext?.fill(0);
    await input.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRecoveryDecrypt(process.argv.slice(2)).catch(async (error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "No se pudo descifrar la recuperación."}\n`);
    process.exitCode = 1;
  });
}
