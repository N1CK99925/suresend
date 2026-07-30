// SureSend <-> Stellar/Soroban integration.

import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
} from "@creit.tech/stellar-wallets-kit";
import * as StellarSdk from "@stellar/stellar-sdk";

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== "false";
export const NETWORK = import.meta.env.VITE_STELLAR_NETWORK || "TESTNET";
export const RPC_URL =
  import.meta.env.VITE_SOROBAN_RPC_URL ||
  "https://soroban-testnet.stellar.org";

export const CONTRACT_ID =
  import.meta.env.VITE_SURESEND_CONTRACT_ID || "";

export const SUSD_CONTRACT_ID =
  import.meta.env.VITE_SUSD_CONTRACT_ID || "";

const NETWORK_PASSPHRASE =
  NETWORK === "PUBLIC"
    ? StellarSdk.Networks.PUBLIC
    : StellarSdk.Networks.TESTNET;

const server = new StellarSdk.rpc.Server(RPC_URL);
let kit = null;

// ---------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------

export function getWalletKit() {
  if (!kit) {
    kit = new StellarWalletsKit({
      network:
        NETWORK === "PUBLIC"
          ? WalletNetwork.PUBLIC
          : WalletNetwork.TESTNET,
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

    const fake =
      "GDEMO" +
      Math.random().toString(36).slice(2, 10).toUpperCase() +
      "SURESEND";

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

export function disconnectWallet() {
  // Clear ONLY the wallet connection state — does NOT wipe demo locks,
  // feedback, or other SureSend data stored under different keys.
  localStorage.removeItem("suresend_active_address");

  if (DEMO_MODE) {
    // In demo mode also clear the demo address so the next
    // connectWallet() call generates a fresh one.
    localStorage.removeItem("suresend_demo_address");
  }

  // Reset the kit's selected wallet so the modal opens fresh on next connect.
  try {
    if (kit) kit.setWallet(undefined);
  } catch (_) {
    // Some kit versions don't support unsetting — that's fine.
  }
}

// ---------------------------------------------------------------------
// Live Soroban helpers
// ---------------------------------------------------------------------

function requireLiveConfig() {
  if (!CONTRACT_ID) {
    throw new Error(
      "VITE_SURESEND_CONTRACT_ID is missing from frontend/.env"
    );
  }

  if (!SUSD_CONTRACT_ID) {
    throw new Error(
      "VITE_SUSD_CONTRACT_ID is missing from frontend/.env"
    );
  }
}

function scAddress(value) {
  return new StellarSdk.Address(value).toScVal();
}

function scSymbol(value) {
  return StellarSdk.nativeToScVal(value, {
    type: "symbol",
  });
}

function scI128(value) {
  return StellarSdk.nativeToScVal(BigInt(value), {
    type: "i128",
  });
}

function scU32(value) {
  return StellarSdk.nativeToScVal(Number(value), {
    type: "u32",
  });
}

function scU64(value) {
  return StellarSdk.nativeToScVal(BigInt(value), {
    type: "u64",
  });
}

function scBool(value) {
  return StellarSdk.nativeToScVal(Boolean(value), {
    type: "bool",
  });
}

async function buildTransaction(sourceAddress, operation) {
  const account = await server.getAccount(sourceAddress);

  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(60)
    .build();

  return transaction;
}

async function signWithConnectedWallet(transaction, sourceAddress) {
  const { signedTxXdr } = await getWalletKit().signTransaction(
    transaction.toXDR(),
    {
      networkPassphrase: NETWORK_PASSPHRASE,
      address: sourceAddress,
    }
  );

  if (!signedTxXdr) {
    throw new Error("The wallet did not return a signed transaction.");
  }

  return StellarSdk.TransactionBuilder.fromXDR(
    signedTxXdr,
    NETWORK_PASSPHRASE
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTransaction(hash) {
  console.log("Waiting for transaction:", hash);
  console.log(
    "Verify on Stellar Expert:",
    `https://stellar.expert/explorer/testnet/tx/${hash}`
  );

  /*
   * We intentionally bypass server.getTransaction() here because
   * the SDK's XDR parser may not support the TransactionMeta
   * version returned by the current testnet protocol (e.g. v4
   * from Protocol 22 causes "Bad union switch: 4" in SDK ≤13).
   *
   * Instead we POST directly to the Soroban JSON-RPC endpoint and
   * read only the plain-JSON "status" field — no XDR decoding.
   */

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      console.log(`Polling attempt ${attempt + 1}...`);

      const res = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: { hash },
        }),
      });

      const json = await res.json();
      const status = json?.result?.status;

      console.log("getTransaction raw status:", status);

      if (status === "SUCCESS") {
        console.log("Transaction SUCCESS:", hash);

        return {
          status: "SUCCESS",
          hash,
        };
      }

      if (status === "FAILED") {
        console.error("Transaction FAILED (raw):", json.result);

        throw new Error(
          `Stellar transaction failed. Hash: ${hash}`
        );
      }

      // status is NOT_FOUND or missing — keep polling
    } catch (err) {
      // Re-throw definitive failures immediately.
      if (err?.message?.includes("transaction failed")) {
        throw err;
      }

      // Network / fetch errors — log and retry.
      console.warn(
        `getTransaction poll error (attempt ${attempt + 1}):`,
        err?.message || err
      );
    }

    await sleep(2000);
  }

  throw new Error(
    `Timed out waiting for transaction confirmation. ` +
      `The transaction may have succeeded — verify: ` +
      `https://stellar.expert/explorer/testnet/tx/${hash}`
  );
}

async function invokeWrite({
  sourceAddress,
  method,
  args = [],
}) {
  requireLiveConfig();

  try {
    const contract = new StellarSdk.Contract(CONTRACT_ID);

    const operation = contract.call(method, ...args);

    const transaction = await buildTransaction(
      sourceAddress,
      operation
    );

    // Simulation determines Soroban resources and authorization.
    const prepared = await server.prepareTransaction(transaction);

    const signed = await signWithConnectedWallet(
  prepared,
  sourceAddress
);

    const submitted = await server.sendTransaction(signed);

    if (
      submitted.status !== "PENDING" &&
      submitted.status !== "DUPLICATE"
    ) {
      console.error("Stellar submission response:", submitted);

      throw new Error(
        `Stellar rejected the transaction (${submitted.status}).`
      );
    }

    return await waitForTransaction(submitted.hash);
  } catch (err) {
    console.error(`SureSend ${method} failed:`, err);

    const message =
      err?.message ||
      err?.toString?.() ||
      "Unknown Stellar transaction error";

    throw new Error(message);
  }
}

async function simulateRead({
  sourceAddress,
  method,
  args = [],
}) {
  requireLiveConfig();

  const contract = new StellarSdk.Contract(CONTRACT_ID);

  const operation = contract.call(method, ...args);

  const transaction = await buildTransaction(
    sourceAddress,
    operation
  );

  const simulation = await server.simulateTransaction(transaction);

  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    console.error("Soroban simulation failed:", simulation);

    throw new Error(
      simulation.error || `Unable to read ${method} from contract.`
    );
  }

  if (!simulation.result?.retval) {
    return null;
  }

  return StellarSdk.scValToNative(simulation.result.retval);
}

// ---------------------------------------------------------------------
// Demo-mode storage
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

// ---------------------------------------------------------------------
// Lock conversion
// ---------------------------------------------------------------------

function normaliseStatus(status) {
  if (typeof status === "string") return status;

  // Soroban enums decoded by scValToNative can appear as arrays/maps
  // depending on SDK/contract representation.
  if (Array.isArray(status) && status.length > 0) {
    return String(status[0]);
  }

  if (status && typeof status === "object") {
    const keys = Object.keys(status);

    if (keys.length === 1) {
      return keys[0];
    }
  }

  return String(status ?? "Unknown");
}

function normaliseLock(lock, explicitId) {
  if (!lock) return null;

  const amountRaw = lock.amount ?? 0;

  // Use the explicit ID when provided (from get_lock iteration),
  // fall back to lock.id (demo mode), then to undefined.
  const rawId = explicitId ?? lock.id;
  const id = rawId !== undefined && rawId !== null
    ? Number(rawId)
    : undefined;

  return {
    id,
    sender: String(lock.sender),
    recipient: String(lock.recipient),
    merchant: String(lock.merchant),

    // SUSD has 7 decimals, like Stellar classic assets.
    amount: Number(amountRaw) / 10_000_000,

    category: String(lock.category),
    status: normaliseStatus(lock.status),

    createdAt: Number(lock.created_at ?? lock.createdAt ?? 0),
    timeoutLedger: Number(
      lock.timeout_ledger ?? lock.timeoutLedger ?? 0
    ),

    refundToSender: Boolean(
      lock.refund_to_sender ?? lock.refundToSender
    ),

    token: String(lock.token ?? SUSD_CONTRACT_ID),

    receiptHash: lock.receipt_hash
      ? String(lock.receipt_hash)
      : undefined,
  };
}

// ---------------------------------------------------------------------
// Public API used by React components
// ---------------------------------------------------------------------
export async function trustSUSD(address) {
  if (DEMO_MODE) return true;

  requireLiveConfig();

  if (!address) {
    throw new Error("Connect your Stellar wallet first.");
  }

  try {
    // IMPORTANT:
    // trust() belongs to the SUSD Stellar Asset Contract,
    // NOT the SureSend contract.
    const susd = new StellarSdk.Contract(SUSD_CONTRACT_ID);

    const operation = susd.call(
      "trust",
      scAddress(address)
    );

    const transaction = await buildTransaction(
      address,
      operation
    );

    const prepared =
      await server.prepareTransaction(transaction);

    // The connected wallet signs its OWN trustline creation.
    const signed =
      await signWithConnectedWallet(prepared, address);

    const submitted =
      await server.sendTransaction(signed);

    if (
      submitted.status !== "PENDING" &&
      submitted.status !== "DUPLICATE"
    ) {
      console.error(
        "SUSD trust submission response:",
        submitted
      );

      throw new Error(
        `Stellar rejected the SUSD trust transaction (${submitted.status}).`
      );
    }

    return await waitForTransaction(submitted.hash);
  } catch (err) {
    console.error("SUSD trust failed:", err);

    throw new Error(
      err?.message ||
        err?.toString?.() ||
        "Unable to create SUSD trustline."
    );
  }
}
export async function approveSUSD(address, amount = 10000000000n) {
  if (DEMO_MODE) return true;

  requireLiveConfig();

  if (!address) {
    throw new Error("Connect your Stellar wallet first.");
  }

  try {
    const susd = new StellarSdk.Contract(SUSD_CONTRACT_ID);

    // Current ledger + plenty of room for the pilot.
    const latest = await server.getLatestLedger();
    const expirationLedger = latest.sequence + 100000;

    const operation = susd.call(
      "approve",
      scAddress(address),                 // from
      scAddress(CONTRACT_ID),             // spender = SureSend
      StellarSdk.nativeToScVal(amount, {
        type: "i128",
      }),
      StellarSdk.nativeToScVal(expirationLedger, {
        type: "u32",
      })
    );

    const transaction = await buildTransaction(address, operation);
    const prepared = await server.prepareTransaction(transaction);

    const signed = await signWithConnectedWallet(prepared, address);
    const submitted = await server.sendTransaction(signed);

    if (
      submitted.status !== "PENDING" &&
      submitted.status !== "DUPLICATE"
    ) {
      console.error("SUSD approval response:", submitted);

      throw new Error(
        `Stellar rejected the SUSD approval transaction (${submitted.status}).`
      );
    }

    return await waitForTransaction(submitted.hash);
  } catch (err) {
    console.error("SUSD approval failed:", err);

    throw new Error(
      err?.message ||
        err?.toString?.() ||
        "Unable to approve SUSD."
    );
  }
}

export async function createLock({
  sender,
  recipient,
  merchant,
  amount,
  category,
  timeoutDays,
  onTimeout,
}) {
  if (DEMO_MODE) {
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

  requireLiveConfig();

  if (!sender) {
    throw new Error("Connect your Stellar wallet first.");
  }

  if (!recipient) {
    throw new Error("Recipient address is required.");
  }

  if (!merchant) {
    throw new Error("Merchant address is required.");
  }

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Enter a valid SUSD amount.");
  }

  // Stellar assets use 7 decimal places.
  const stroops = BigInt(
    Math.round(numericAmount * 10_000_000)
  );

  /*
   * Contract expects an absolute ledger number.
   *
   * Stellar ledgers close roughly every ~5 seconds, so:
   *     days * 24 * 60 * 60 / 5
   *
   * We use the RPC health response's latest ledger as our base.
   */
  const health = await server.getHealth();

  const currentLedger = Number(health.latestLedger);

  const ledgersPerDay = Math.ceil(86400 / 5);

  const timeoutLedger =
    currentLedger +
    Math.max(
      ledgersPerDay,
      Math.ceil(Number(timeoutDays) * ledgersPerDay)
    );

  const refundToSender =
    onTimeout === "RefundToSender";

  const result = await invokeWrite({
    sourceAddress: sender,
    method: "create_lock",
    args: [
  scAddress(sender),
  scAddress(recipient),
  scAddress(merchant),
  scSymbol(category),
  scAddress(SUSD_CONTRACT_ID),
  scI128(stroops),
  scU32(timeoutLedger),
  scBool(refundToSender),
],
  });

  return result;
}

export async function getSUSDBalance(address) {
  if (DEMO_MODE) return 0n;

  requireLiveConfig();

  if (!address) {
    throw new Error("Connect your Stellar wallet first.");
  }

  try {
    const susd = new StellarSdk.Contract(SUSD_CONTRACT_ID);

    const operation = susd.call(
      "balance",
      scAddress(address)
    );

    const transaction = await buildTransaction(address, operation);

    const simulation = await server.simulateTransaction(transaction);

    if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
      console.error("SUSD balance simulation failed:", simulation);
      throw new Error("Unable to read SUSD balance.");
    }

    if (!simulation.result?.retval) return 0n;

    const native = StellarSdk.scValToNative(simulation.result.retval);

    // Ensure BigInt return for consistency (i128 from token contract)
    return BigInt(native ?? 0);
  } catch (err) {
    console.error("getSUSDBalance failed:", err);
    throw new Error(err?.message || "Unable to read SUSD balance.");
  }
}

export async function attestDelivery(lockId) {
  if (DEMO_MODE) {
    const locks = readLocks();

    const lock = locks.find(
      (l) => l.id === Number(lockId)
    );

    if (lock && lock.status === "Locked") {
      lock.status = "DeliveryAttested";
    }

    writeLocks(locks);

    return lock;
  }

  const { address } = await getWalletKit().getAddress();

  if (!address) {
    throw new Error("Connect the merchant wallet first.");
  }

  return invokeWrite({
    sourceAddress: address,
    method: "attest_delivery",
    args: [
      scAddress(address),
      scU64(lockId),
    ],
  });
}

export async function claimLock(lockId) {
  if (DEMO_MODE) {
    const locks = readLocks();

    const lock = locks.find(
      (l) => l.id === Number(lockId)
    );

    if (
      lock &&
      lock.status === "DeliveryAttested"
    ) {
      lock.status = "Claimed";

      lock.receiptHash =
        "demo-" +
        Math.random().toString(36).slice(2, 12);
    }

    writeLocks(locks);

    return lock;
  }

  const { address } = await getWalletKit().getAddress();

  if (!address) {
    throw new Error("Connect the merchant wallet first.");
  }

  return invokeWrite({
    sourceAddress: address,
    method: "claim",
    args: [
      scAddress(address),
      scU64(lockId),
    ],
  });
}

export async function getLocksFor(address, role) {
  if (!address) return [];

  if (DEMO_MODE) {
    const locks = readLocks();

    return locks.filter(
      (l) => l[role] === address
    );
  }

  /*
   * The contract's get_locks_for returns Vec<Lock> WITHOUT lock IDs.
   * Since attest_delivery / claim need the real lock_id, we instead
   * iterate all locks via get_lock_count + get_lock(id) and filter
   * by role client-side. This is fine for a pilot with few locks.
   */

  try {
    const count = await simulateRead({
      sourceAddress: address,
      method: "get_lock_count",
      args: [],
    });

    const totalLocks = Number(count ?? 0);
    if (totalLocks === 0) return [];

    console.log(`getLocksFor: scanning ${totalLocks} locks for ${role}=${address.slice(0,8)}...`);

    const out = [];

    for (let id = 1; id <= totalLocks; id++) {
      try {
        const lock = await simulateRead({
          sourceAddress: address,
          method: "get_lock",
          args: [scU64(id)],
        });

        if (!lock) continue;

        // Match by role
        const lockAddress =
          role === "sender"    ? String(lock.sender) :
          role === "merchant"  ? String(lock.merchant) :
          role === "recipient" ? String(lock.recipient) :
          null;

        if (lockAddress === address) {
          const normalised = normaliseLock(lock, id);
          if (normalised) out.push(normalised);
        }
      } catch (lockErr) {
        // Individual lock may have expired from storage; skip it
        console.warn(`getLocksFor: could not read lock ${id}:`, lockErr?.message);
      }
    }

    return out;
  } catch (err) {
    console.error("getLocksFor failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------

export async function submitFeedback(entry) {
  // Demo mode: keep local storage behaviour
  if (DEMO_MODE) {
    const all = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(all));
    return;
  }

  // Live mode: POST to Netlify function which stores to the repo via GitHub API.
  try {
    await fetch('/.netlify/functions/submit-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch (err) {
    console.error('submitFeedback failed, falling back to local storage', err);
    const all = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(all));
  }
}

export async function getAllFeedback() {
  if (DEMO_MODE) {
    return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
  }

  try {
    const res = await fetch('/.netlify/functions/get-feedback');
    if (!res.ok) throw new Error('Could not fetch feedback');
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('getAllFeedback failed, falling back to local storage', err);
    return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
  }
}

// Re-export SDK for debugging/scripts.
export { StellarSdk };