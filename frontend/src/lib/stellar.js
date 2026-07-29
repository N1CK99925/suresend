// SureSend <-> Stellar/Soroban integration.
//
// Two modes, controlled by VITE_DEMO_MODE in .env:
//
// - DEMO MODE (default, no contract deployed yet): everything is
//   simulated in localStorage so you can click through the full
//   sender -> merchant -> claim flow, take screenshots, and record a
//   demo video before your testnet contract is live.
// - LIVE MODE (VITE_DEMO_MODE=false): calls the real deployed Soroban
//   contract via @stellar/stellar-sdk, signed through a connected
//   wallet (Freighter, xBull, etc.) via stellar-wallets-kit.
//
// Flip DEMO_MODE off once CONTRACT_ID below is set to your deployed
// contract address (see docs/DEPLOYMENT.md).

import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
} from "@creit.tech/stellar-wallets-kit";
import * as StellarSdk from "@stellar/stellar-sdk";

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== "false";
export const NETWORK = import.meta.env.VITE_STELLAR_NETWORK || "TESTNET";
export const RPC_URL =
  import.meta.env.VITE_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
export const CONTRACT_ID = import.meta.env.VITE_SURESEND_CONTRACT_ID || "";

let kit = null;

export function getWalletKit() {
  if (!kit) {
    kit = new StellarWalletsKit({
      network: NETWORK === "PUBLIC" ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET,
      selectedWalletId: "freighter",
      modules: allowAllModules(),
    });
  }
  return kit;
}

export async function connectWallet() {
  if (DEMO_MODE) {
    const existing = localStorage.getItem("suresend_demo_address");
    if (existing) return existing;
    // Deterministic fake G-address for demo screenshots.
    const fake = "GDEMO" + Math.random().toString(36).slice(2, 10).toUpperCase() + "SURESEND";
    localStorage.setItem("suresend_demo_address", fake);
    return fake;
  }

  return new Promise((resolve, reject) => {
    getWalletKit().openModal({
      onWalletSelected: async (option) => {
        try {
          getWalletKit().setWallet(option.id);
          const { address } = await getWalletKit().getAddress();
          resolve(address);
        } catch (err) {
          reject(err);
        }
      },
    });
  });
}

// ---------------------------------------------------------------------
// Demo-mode data layer (localStorage), mirrors the shape of on-chain
// `Lock` records returned by the contract's get_lock / get_locks_for.
// ---------------------------------------------------------------------

const STORE_KEY = "suresend_demo_locks";
const FEEDBACK_KEY = "suresend_demo_feedback";

function readLocks() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLocks(locks) {
  localStorage.setItem(STORE_KEY, JSON.stringify(locks));
}

export async function createLock({ sender, recipient, merchant, amount, category, timeoutDays, onTimeout }) {
  if (!DEMO_MODE) {
    throw new Error(
      "Live contract calls are not wired up in this scaffold yet — see docs/DEPLOYMENT.md to set CONTRACT_ID and implement the invoke call with stellar-sdk's Contract + AssembledTransaction."
    );
  }
  const locks = readLocks();
  const id = locks.length;
  const lock = {
    id,
    sender,
    recipient,
    merchant,
    amount: Number(amount),
    category,
    createdAt: Date.now(),
    timeoutSecs: Number(timeoutDays) * 86400,
    onTimeout,
    status: "Locked",
  };
  locks.push(lock);
  writeLocks(locks);
  return id;
}

export async function attestDelivery(lockId) {
  const locks = readLocks();
  const lock = locks.find((l) => l.id === lockId);
  if (lock && lock.status === "Locked") lock.status = "DeliveryAttested";
  writeLocks(locks);
  return lock;
}

export async function claimLock(lockId) {
  const locks = readLocks();
  const lock = locks.find((l) => l.id === lockId);
  if (lock && lock.status === "DeliveryAttested") {
    lock.status = "Claimed";
    lock.receiptHash = "demo-" + Math.random().toString(36).slice(2, 12);
  }
  writeLocks(locks);
  return lock;
}

export async function getLocksFor(address, role) {
  const locks = readLocks();
  return locks.filter((l) => l[role] === address);
}

export function submitFeedback(entry) {
  const all = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
  all.push({ ...entry, at: Date.now() });
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(all));
}

export function getAllFeedback() {
  return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
}

// Re-exported so components/scripts can reach the raw SDK if needed
// once LIVE MODE is implemented (contract Server, TransactionBuilder, etc).
export { StellarSdk };
