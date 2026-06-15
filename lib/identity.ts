// Agent identity. Each agent is an ed25519 keypair; its base58 public key is its
// DID. The merchant signs every Alpha Signal payload so a buyer can verify the
// exact recommendation came from this agent and was not tampered with.

import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { sha256 } from "@noble/hashes/sha256";
import bs58 from "bs58";

// @noble/ed25519 v2 needs a sync sha512 wired up for sync signing.
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const fromHex = (s: string) => Uint8Array.from(Buffer.from(s, "hex"));

export interface AgentKey {
  secret: Uint8Array;
  pubkey: string; // base58 DID
}

// Derive a stable demo keypair from a string seed so the app runs out of the
// box. A real merchant supplies LODE_MERCHANT_SECRET (base58) instead.
export function agentFromSeed(seed: string): AgentKey {
  const secret = sha256(new TextEncoder().encode(`lode:agent:${seed}`));
  const pub = ed.getPublicKey(secret);
  return { secret, pubkey: bs58.encode(pub) };
}

export function loadMerchant(): AgentKey {
  const fromEnv = process.env.LODE_MERCHANT_SECRET;
  if (fromEnv) {
    const secret = bs58.decode(fromEnv).slice(0, 32);
    const pub = ed.getPublicKey(secret);
    return { secret, pubkey: bs58.encode(pub) };
  }
  return agentFromSeed("merchant-lode-prime");
}

export function canonicalize(payload: unknown): string {
  // stable key ordering so the hash is reproducible
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      return Object.keys(v as object)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = sort((v as Record<string, unknown>)[k]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(sort(payload));
}

export function hashPayload(payload: unknown): string {
  return hex(sha256(new TextEncoder().encode(canonicalize(payload))));
}

export function sign(payloadHash: string, key: AgentKey): string {
  return hex(ed.sign(fromHex(payloadHash), key.secret));
}

export function verify(payloadHash: string, signature: string, pubkey: string): boolean {
  try {
    return ed.verify(fromHex(signature), fromHex(payloadHash), bs58.decode(pubkey));
  } catch {
    return false;
  }
}
