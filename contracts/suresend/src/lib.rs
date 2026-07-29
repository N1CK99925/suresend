//! SureSend - purpose-locked remittances
//!
//! A remittance is deposited as a `Lock`: stablecoin held by this contract,
//! tagged with a `category` (school / medicine / utility) and a specific
//! `merchant` anchor address. Only that merchant - and only if it remains
//! whitelisted by the admin for that category - can move the lock through
//! its lifecycle:
//!
//!   Locked -> (merchant attests delivery) -> DeliveryAttested -> (merchant claims) -> Claimed
//!
//! The attestation step is deliberately its own transaction, not folded
//! into `claim`, because the whole point of this product is that funds
//! only settle once the underlying service/good has actually been
//! delivered - "just a normal remittance with extra steps" is exactly the
//! failure mode this is meant to avoid (see the original idea doc's
//! complexity evaluation).
//!
//! If nothing happens before `timeout_ledger`, anyone can call `expire`,
//! which pays out per the sender's choice made at creation time: back to
//! the sender, or released unrestricted to the recipient's own wallet.

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env, Symbol, Vec,
};

#[contracttype]
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Status {
    Locked,
    DeliveryAttested,
    Claimed,
    Expired,
}

#[contracttype]
#[derive(Clone)]
pub struct Lock {
    pub sender: Address,
    pub recipient: Address,
    pub merchant: Address,
    pub category: Symbol,
    pub token: Address,
    pub amount: i128,
    pub created_at: u64,
    pub timeout_ledger: u32,
    /// Choice made by the sender at creation time: true = unclaimed funds
    /// bounce back to the sender on expiry, false = unclaimed funds release
    /// to the recipient's own wallet (no longer purpose-locked).
    pub refund_to_sender: bool,
    pub status: Status,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    LockCounter,
    Lock(u64),
    /// merchant address + category -> whitelisted bool
    Whitelist(Address, Symbol),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotAdmin = 2,
    MerchantNotWhitelisted = 3,
    LockNotFound = 4,
    WrongMerchant = 5,
    WrongStatus = 6,
    TimeoutNotReached = 7,
    InvalidAmount = 8,
    InvalidRole = 9,
}

const LEDGER_BUMP: u32 = 120_960; // ~7 days at 5s/ledger
const LEDGER_THRESHOLD: u32 = 100_800;

#[contract]
pub struct SureSendContract;

#[contractimpl]
impl SureSendContract {
    /// One-time setup. `admin` is the only address allowed to whitelist
    /// merchant anchors.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::LockCounter, &0u64);
        Ok(())
    }

    fn require_admin(env: &Env, admin: &Address) -> Result<(), Error> {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotAdmin)?;
        if *admin != stored_admin {
            return Err(Error::NotAdmin);
        }
        Ok(())
    }

    /// Admin-only: mark `merchant` as an approved redemption point for
    /// `category` (e.g. a specific school approved for `"school"`).
    pub fn add_merchant(
        env: Env,
        admin: Address,
        merchant: Address,
        category: Symbol,
    ) -> Result<(), Error> {
        Self::require_admin(&env, &admin)?;
        let key = DataKey::Whitelist(merchant, category);
        env.storage().persistent().set(&key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_BUMP);
        Ok(())
    }

    /// Admin-only: revoke a merchant's whitelisting for a category.
    pub fn remove_merchant(
        env: Env,
        admin: Address,
        merchant: Address,
        category: Symbol,
    ) -> Result<(), Error> {
        Self::require_admin(&env, &admin)?;
        env.storage()
            .persistent()
            .remove(&DataKey::Whitelist(merchant, category));
        Ok(())
    }

    pub fn is_whitelisted(env: Env, merchant: Address, category: Symbol) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Whitelist(merchant, category))
            .unwrap_or(false)
    }

    /// Sender locks `amount` of `token` for `recipient`, redeemable only by
    /// `merchant` under `category`. Requires sender auth and sufficient
    /// token allowance/balance. Returns the new lock id.
    pub fn create_lock(
        env: Env,
        sender: Address,
        recipient: Address,
        merchant: Address,
        category: Symbol,
        token: Address,
        amount: i128,
        timeout_ledger: u32,
        refund_to_sender: bool,
    ) -> Result<u64, Error> {
        sender.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Pull funds from the sender into this contract's custody.
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &amount);

        let mut counter: u64 = env
            .storage()
            .instance()
            .get(&DataKey::LockCounter)
            .unwrap_or(0);
        counter += 1;

        let lock = Lock {
            sender: sender.clone(),
            recipient,
            merchant,
            category,
            token,
            amount,
            created_at: env.ledger().timestamp(),
            timeout_ledger,
            refund_to_sender,
            status: Status::Locked,
        };

        let key = DataKey::Lock(counter);
        env.storage().persistent().set(&key, &lock);
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_BUMP);
        env.storage().instance().set(&DataKey::LockCounter, &counter);

        env.events()
            .publish((Symbol::new(&env, "created"), sender), counter);

        Ok(counter)
    }

    /// Merchant attests that the underlying service/good was delivered.
    /// This does not move funds - it just opens the door for `claim`. Kept
    /// as its own step so a future version can require a second signer
    /// (e.g. the recipient) here without changing the rest of the flow.
    pub fn attest_delivery(env: Env, merchant: Address, lock_id: u64) -> Result<(), Error> {
        merchant.require_auth();

        let key = DataKey::Lock(lock_id);
        let mut lock: Lock = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::LockNotFound)?;

        if lock.merchant != merchant {
            return Err(Error::WrongMerchant);
        }
        if lock.status != Status::Locked {
            return Err(Error::WrongStatus);
        }

        lock.status = Status::DeliveryAttested;
        env.storage().persistent().set(&key, &lock);

        env.events()
            .publish((Symbol::new(&env, "attested"), merchant), lock_id);

        Ok(())
    }

    /// Merchant redeems the lock once delivery has been attested. Only the
    /// exact merchant address named on the lock, and only while it remains
    /// whitelisted for that category, can call this successfully.
    pub fn claim(env: Env, merchant: Address, lock_id: u64) -> Result<(), Error> {
        merchant.require_auth();

        let key = DataKey::Lock(lock_id);
        let mut lock: Lock = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::LockNotFound)?;

        if lock.merchant != merchant {
            return Err(Error::WrongMerchant);
        }
        if lock.status != Status::DeliveryAttested {
            return Err(Error::WrongStatus);
        }
        let whitelisted: bool = env
            .storage()
            .persistent()
            .get(&DataKey::Whitelist(merchant.clone(), lock.category.clone()))
            .unwrap_or(false);
        if !whitelisted {
            return Err(Error::MerchantNotWhitelisted);
        }

        let token_client = token::Client::new(&env, &lock.token);
        token_client.transfer(&env.current_contract_address(), &merchant, &lock.amount);

        lock.status = Status::Claimed;
        env.storage().persistent().set(&key, &lock);

        env.events()
            .publish((Symbol::new(&env, "claimed"), merchant), lock_id);

        Ok(())
    }

    /// After `timeout_ledger` has passed with no claim, anyone can trigger
    /// expiry; funds move per the sender's original choice. This can be
    /// called by an off-chain job/bot - it needs no special auth because
    /// the destination was fixed at creation time.
    pub fn expire(env: Env, lock_id: u64) -> Result<(), Error> {
        let key = DataKey::Lock(lock_id);
        let mut lock: Lock = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::LockNotFound)?;

        if lock.status == Status::Claimed || lock.status == Status::Expired {
            return Err(Error::WrongStatus);
        }
        if env.ledger().sequence() < lock.timeout_ledger {
            return Err(Error::TimeoutNotReached);
        }

        let destination = if lock.refund_to_sender {
            lock.sender.clone()
        } else {
            lock.recipient.clone()
        };

        let token_client = token::Client::new(&env, &lock.token);
        token_client.transfer(&env.current_contract_address(), &destination, &lock.amount);

        lock.status = Status::Expired;
        env.storage().persistent().set(&key, &lock);

        env.events()
            .publish((Symbol::new(&env, "expired"), destination), lock_id);

        Ok(())
    }

    pub fn get_lock(env: Env, lock_id: u64) -> Result<Lock, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Lock(lock_id))
            .ok_or(Error::LockNotFound)
    }

    pub fn get_lock_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::LockCounter)
            .unwrap_or(0)
    }

    /// Linear scan over all locks, filtered by `role` ("sender",
    /// "merchant", or "recipient") matching `address`. Fine for a pilot
    /// with a few hundred locks; an off-chain indexer (ingesting the
    /// `created`/`attested`/`claimed`/`expired` events above) is the right
    /// fix once volume grows - see docs/ARCHITECTURE.md.
    pub fn get_locks_for(env: Env, address: Address, role: Symbol) -> Result<Vec<Lock>, Error> {
        let sender_role = Symbol::new(&env, "sender");
        let merchant_role = Symbol::new(&env, "merchant");
        let recipient_role = Symbol::new(&env, "recipient");

        if role != sender_role && role != merchant_role && role != recipient_role {
            return Err(Error::InvalidRole);
        }

        let count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::LockCounter)
            .unwrap_or(0);

        let mut out = Vec::new(&env);
        let mut i: u64 = 1;
        while i <= count {
            if let Some(lock) = env.storage().persistent().get::<_, Lock>(&DataKey::Lock(i)) {
                let matches = if role == sender_role {
                    lock.sender == address
                } else if role == merchant_role {
                    lock.merchant == address
                } else {
                    lock.recipient == address
                };
                if matches {
                    out.push_back(lock);
                }
            }
            i += 1;
        }
        Ok(out)
    }
}

mod test;
