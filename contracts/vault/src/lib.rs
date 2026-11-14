use near_sdk::{
    env, near, AccountId, NearToken, PanicOnDefault, Promise,
    json_types::U128,
};

/// The balance lives in the contract account. A public key limited to `ping`
/// cannot transfer NEAR or invoke `withdraw`, even outside the extension.
///
/// IMPORTANT: Full-access keys on this contract account still control its NEAR.
/// Never publish such a key. The owner_id MUST be a separate account.
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct SynosisVault {
    owner_id: AccountId,
}

#[near]
impl SynosisVault {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        assert!(!env::state_exists(), "Vault already initialized");
        assert_ne!(
            owner_id,
            env::current_account_id(),
            "Owner must be a separate external account"
        );
        Self { owner_id }
    }

    /// This is the only function the public challenge key should be allowed to call.
    pub fn ping(&self) -> String {
        "synosis-guard-active".to_string()
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner_id.clone()
    }

    pub fn get_balance(&self) -> U128 {
        U128(env::account_balance().as_yoctonear())
    }

    #[payable]
    pub fn deposit(&mut self) {
        assert!(
            env::attached_deposit().as_yoctonear() > 0,
            "Attach positive testnet NEAR"
        );
    }

    /// Call from the configured owner account, not the public challenge account.
    pub fn withdraw(&mut self, receiver_id: AccountId, amount: U128) -> Promise {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner_id,
            "Only the separately authorized owner can withdraw"
        );
        assert!(amount.0 > 0, "Amount must be positive");
        // Keep a reserve so a withdrawal cannot empty the deployed contract.
        // NEAR also enforces the actual required contract storage balance.
        let reserve = NearToken::from_yoctonear(500_000_000_000_000_000_000_000u128);
        let balance = env::account_balance().as_yoctonear();
        assert!(
            balance >= amount.0.saturating_add(reserve.as_yoctonear()),
            "Insufficient balance after reserve"
        );
        Promise::new(receiver_id).transfer(NearToken::from_yoctonear(amount.0))
    }

    pub fn change_owner(&mut self, new_owner_id: AccountId) {
        assert_eq!(env::predecessor_account_id(), self.owner_id, "Only owner can change owner");
        assert_ne!(new_owner_id, env::current_account_id(), "Owner must stay external");
        self.owner_id = new_owner_id;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn context(predecessor: &str) {
        let mut builder = VMContextBuilder::new();
        builder.current_account_id("vault.testnet".parse().unwrap());
        builder.predecessor_account_id(predecessor.parse().unwrap());
        builder.account_balance(NearToken::from_near(10));
        testing_env!(builder.build());
    }

    #[test]
    fn ping_and_owner() {
        context("vault.testnet");
        let vault = SynosisVault::new("owner.testnet".parse().unwrap());
        assert_eq!(vault.ping(), "synosis-guard-active");
        assert_eq!(vault.get_owner().as_str(), "owner.testnet");
    }

    #[test]
    #[should_panic(expected = "Only the separately authorized owner can withdraw")]
    fn public_challenge_account_cannot_withdraw() {
        context("vault.testnet");
        let mut vault = SynosisVault::new("owner.testnet".parse().unwrap());
        vault.withdraw("destination.testnet".parse().unwrap(), U128(1));
    }

    #[test]
    fn separate_owner_can_initiate_withdrawal() {
        context("vault.testnet");
        let mut vault = SynosisVault::new("owner.testnet".parse().unwrap());
        context("owner.testnet");
        let _receipt = vault.withdraw(
            "destination.testnet".parse().unwrap(),
            U128(1_000_000_000_000_000_000_000_000)
        );
    }

    #[test]
    #[should_panic(expected = "Owner must be a separate external account")]
    fn cannot_set_contract_account_as_owner() {
        context("vault.testnet");
        SynosisVault::new("vault.testnet".parse().unwrap());
    }
}
