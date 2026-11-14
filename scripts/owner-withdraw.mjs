import { Account, JsonRpcProvider, actions, nearToYocto, teraToGas } from 'near-api-js';

const RPC = 'https://rpc.testnet.near.org';
const vaultId = process.env.CHALLENGE_ACCOUNT_ID?.trim();
const ownerId = process.env.VAULT_OWNER_ACCOUNT_ID?.trim();
const ownerKey = process.env.VAULT_OWNER_PRIVATE_KEY?.trim();
const receiverId = process.env.WITHDRAW_RECEIVER_ACCOUNT_ID?.trim();
const amountNear = process.env.WITHDRAW_AMOUNT_NEAR?.trim();
for (const [name, id] of [
  ['CHALLENGE_ACCOUNT_ID', vaultId],
  ['VAULT_OWNER_ACCOUNT_ID', ownerId],
  ['WITHDRAW_RECEIVER_ACCOUNT_ID', receiverId]
]) {
  if (!/^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.testnet$/.test(id || '')) {
    throw new Error(name + ' must be a NEAR Testnet account ending in .testnet.');
  }
}
if (!ownerKey?.startsWith('ed25519:')) {
  throw new Error('VAULT_OWNER_PRIVATE_KEY is required locally and must not be published.');
}
if (!/^(?:0|[1-9]\d*)(?:\.\d{1,24})?$/.test(amountNear || '') || !/[1-9]/.test(amountNear || '')) {
  throw new Error('WITHDRAW_AMOUNT_NEAR must be positive, with no more than 24 decimal places.');
}
if (process.env.CONFIRM_WITHDRAWAL !== 'YES') {
  throw new Error('Set CONFIRM_WITHDRAWAL=YES after reviewing the recipient and amount.');
}
const provider = new JsonRpcProvider({ url: RPC });
const onChainOwner = await provider.callFunction({ contractId: vaultId, method: 'get_owner', args: {} });
if (onChainOwner !== ownerId) throw new Error('Configured owner does not match the vault owner on chain.');
const owner = new Account(ownerId, provider, ownerKey);
const amountYocto = nearToYocto(amountNear);
const result = await owner.signAndSendTransaction({
  receiverId: vaultId,
  actions: [
    actions.functionCall(
      'withdraw',
      { receiver_id: receiverId, amount: amountYocto.toString() },
      teraToGas('30'),
      0n
    )
  ],
  waitUntil: 'FINAL'
});
console.log('Owner withdrawal transaction finalized on NEAR Testnet.');
console.log({ vaultId, ownerId, receiverId, amountNear, transactionHash: result.transaction?.hash });
