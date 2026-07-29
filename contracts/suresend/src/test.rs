#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, Symbol,
};

fn create_token_contract<'a>(
    env: &Env,
    admin: &Address,
) -> (Address, token::StellarAssetClient<'a>, token::Client<'a>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let address = sac.address();
    (
        address.clone(),
        token::StellarAssetClient::new(env, &address),
        token::Client::new(env, &address),
    )
}

struct Setup<'a> {
    env: Env,
    client: SureSendContractClient<'a>,
    admin: Address,
    sender: Address,
    recipient: Address,
    merchant: Address,
    token_address: Address,
    token_client: token::Client<'a>,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let merchant = Address::generate(&env);

    let contract_id = env.register(SureSendContract, ());
    let client = SureSendContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    let (token_address, token_admin_client, token_client) = create_token_contract(&env, &admin);
    token_admin_client.mint(&sender, &1_000_000_000);

    Setup {
        env,
        client,
        admin,
        sender,
        recipient,
        merchant,
        token_address,
        token_client,
    }
}

#[test]
fn test_full_happy_path_lock_attest_claim() {
    let s = setup();
    let category = Symbol::new(&s.env, "school");

    s.client.add_merchant(&s.admin, &s.merchant, &category);
    assert!(s.client.is_whitelisted(&s.merchant, &category));

    let timeout = s.env.ledger().sequence() + 1000;
    let lock_id = s.client.create_lock(
        &s.sender,
        &s.recipient,
        &s.merchant,
        &category,
        &s.token_address,
        &50_000_000i128,
        &timeout,
        &true,
    );

    let lock = s.client.get_lock(&lock_id);
    assert_eq!(lock.status, Status::Locked);

    s.client.attest_delivery(&s.merchant, &lock_id);
    let lock = s.client.get_lock(&lock_id);
    assert_eq!(lock.status, Status::DeliveryAttested);

    assert_eq!(s.token_client.balance(&s.merchant), 0);
    s.client.claim(&s.merchant, &lock_id);
    assert_eq!(s.token_client.balance(&s.merchant), 50_000_000);

    let lock = s.client.get_lock(&lock_id);
    assert_eq!(lock.status, Status::Claimed);
}

#[test]
fn test_claim_without_attestation_fails() {
    let s = setup();
    let category = Symbol::new(&s.env, "school");
    s.client.add_merchant(&s.admin, &s.merchant, &category);

    let timeout = s.env.ledger().sequence() + 1000;
    let lock_id = s.client.create_lock(
        &s.sender,
        &s.recipient,
        &s.merchant,
        &category,
        &s.token_address,
        &10_000_000i128,
        &timeout,
        &true,
    );

    // Never attested.
    let result = s.client.try_claim(&s.merchant, &lock_id);
    assert_eq!(result, Err(Ok(Error::WrongStatus)));
}

#[test]
fn test_non_whitelisted_merchant_cannot_claim() {
    let s = setup();
    let category = Symbol::new(&s.env, "school");
    // Note: merchant was never whitelisted.

    let timeout = s.env.ledger().sequence() + 1000;
    let lock_id = s.client.create_lock(
        &s.sender,
        &s.recipient,
        &s.merchant,
        &category,
        &s.token_address,
        &10_000_000i128,
        &timeout,
        &true,
    );

    s.client.attest_delivery(&s.merchant, &lock_id);
    let result = s.client.try_claim(&s.merchant, &lock_id);
    assert_eq!(result, Err(Ok(Error::MerchantNotWhitelisted)));
}

#[test]
fn test_expire_refunds_sender_before_attestation() {
    let s = setup();
    let category = Symbol::new(&s.env, "school");
    s.client.add_merchant(&s.admin, &s.merchant, &category);

    let timeout = s.env.ledger().sequence() + 10;
    let lock_id = s.client.create_lock(
        &s.sender,
        &s.recipient,
        &s.merchant,
        &category,
        &s.token_address,
        &25_000_000i128,
        &timeout,
        &true, // refund to sender
    );

    let result = s.client.try_expire(&lock_id);
    assert_eq!(result, Err(Ok(Error::TimeoutNotReached)));

    s.env.ledger().with_mut(|l| l.sequence_number = timeout + 1);

    let before = s.token_client.balance(&s.sender);
    s.client.expire(&lock_id);
    assert_eq!(s.token_client.balance(&s.sender), before + 25_000_000);

    let lock = s.client.get_lock(&lock_id);
    assert_eq!(lock.status, Status::Expired);
}

#[test]
fn test_expire_releases_to_recipient_when_chosen() {
    let s = setup();
    let category = Symbol::new(&s.env, "school");
    s.client.add_merchant(&s.admin, &s.merchant, &category);

    let timeout = s.env.ledger().sequence() + 10;
    let lock_id = s.client.create_lock(
        &s.sender,
        &s.recipient,
        &s.merchant,
        &category,
        &s.token_address,
        &12_000_000i128,
        &timeout,
        &false, // release to recipient instead of bouncing back
    );

    s.env.ledger().with_mut(|l| l.sequence_number = timeout + 1);
    s.client.expire(&lock_id);

    assert_eq!(s.token_client.balance(&s.recipient), 12_000_000);
}

#[test]
fn test_expire_still_works_after_attestation_if_never_claimed() {
    let s = setup();
    let category = Symbol::new(&s.env, "school");
    s.client.add_merchant(&s.admin, &s.merchant, &category);

    let timeout = s.env.ledger().sequence() + 10;
    let lock_id = s.client.create_lock(
        &s.sender,
        &s.recipient,
        &s.merchant,
        &category,
        &s.token_address,
        &7_000_000i128,
        &timeout,
        &true,
    );

    s.client.attest_delivery(&s.merchant, &lock_id);
    s.env.ledger().with_mut(|l| l.sequence_number = timeout + 1);

    let before = s.token_client.balance(&s.sender);
    s.client.expire(&lock_id);
    assert_eq!(s.token_client.balance(&s.sender), before + 7_000_000);
}

#[test]
fn test_double_claim_fails() {
    let s = setup();
    let category = Symbol::new(&s.env, "school");
    s.client.add_merchant(&s.admin, &s.merchant, &category);

    let timeout = s.env.ledger().sequence() + 1000;
    let lock_id = s.client.create_lock(
        &s.sender,
        &s.recipient,
        &s.merchant,
        &category,
        &s.token_address,
        &5_000_000i128,
        &timeout,
        &true,
    );

    s.client.attest_delivery(&s.merchant, &lock_id);
    s.client.claim(&s.merchant, &lock_id);
    let result = s.client.try_claim(&s.merchant, &lock_id);
    assert_eq!(result, Err(Ok(Error::WrongStatus)));
}

#[test]
fn test_only_admin_can_whitelist() {
    let s = setup();
    let category = Symbol::new(&s.env, "school");
    let impostor = Address::generate(&s.env);

    let result = s.client.try_add_merchant(&impostor, &s.merchant, &category);
    assert_eq!(result, Err(Ok(Error::NotAdmin)));
}

#[test]
fn test_get_locks_for_filters_by_role() {
    let s = setup();
    let category = Symbol::new(&s.env, "school");
    s.client.add_merchant(&s.admin, &s.merchant, &category);

    let timeout = s.env.ledger().sequence() + 1000;
    s.client.create_lock(
        &s.sender,
        &s.recipient,
        &s.merchant,
        &category,
        &s.token_address,
        &1_000_000i128,
        &timeout,
        &true,
    );
    s.client.create_lock(
        &s.sender,
        &s.recipient,
        &s.merchant,
        &category,
        &s.token_address,
        &2_000_000i128,
        &timeout,
        &true,
    );

    let sender_role = Symbol::new(&s.env, "sender");
    let by_sender = s.client.get_locks_for(&s.sender, &sender_role);
    assert_eq!(by_sender.len(), 2);

    let other = Address::generate(&s.env);
    let by_other = s.client.get_locks_for(&other, &sender_role);
    assert_eq!(by_other.len(), 0);
}
