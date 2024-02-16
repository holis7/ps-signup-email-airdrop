import {
  useAccount,
  useNetwork,
  usePublicClient,
  useSwitchNetwork,
  useWalletClient,
} from 'use-wagmi';
import { getContract } from 'viem';
import { moonbaseAlpha, moonbeam } from 'use-wagmi/chains';
import { abi } from '~/lib/config/abi';
import { Chains, Environments } from '~/lib/values/general.values';

export default function useContract() {
  const message = useMessage();
  const config = useRuntimeConfig();
  const { chain } = useNetwork();
  const { address } = useAccount();
  const { switchNetwork } = useSwitchNetwork();
  const publicClient = usePublicClient();
  const { data: walletClient, refetch } = useWalletClient();

  const usedChain = config.public.CHAIN_ID === Chains.MOONBASE ? moonbaseAlpha : moonbeam;
  const contract = ref();

  async function getTokenUri(id: number) {
    return (await contract.value.read.tokenURI([id])) as string;
  }

  /**
   * Helper for initializing specific contract
   */
  async function initContract(contractAddress: string) {
    if (!walletClient.value) {
      await refetch();
      await sleep(200);
    }
    if (!chain || !chain.value || chain?.value.id !== usedChain.id) {
      switchNetwork(usedChain.id);
    }

    if (!contractAddress) {
      message.warning('Please provide contract address in config!');
    } else {
      contract.value = getContract({
        address: contractAddress,
        abi,
        walletClient: walletClient.value || undefined,
        publicClient: publicClient.value,
      });
    }
  }

  function contractError(e: any) {
    console.error('Use contracts error', e.code, e);

    // ignore user declined
    if (e?.code !== 4001) {
      const errorData =
        e?.reason ||
        e?.data?.message ||
        e?.error?.data?.message ||
        e?.error?.message ||
        e?.message ||
        '';
      let msg = '';

      if (errorData.includes('insufficient funds')) {
        // Insufficient funds
        msg = 'Wallet account does not have enough funds.';
      } else if (errorData.includes('Purchase would exceed max supply')) {
        // Max supply exceeded
        msg = 'Tokens depleted. You have requested too many or there is no more supply.';
      } else if (errorData.includes('Wallet already used')) {
        // Wallet already used
        msg = 'Wallet already used. This token has a limit of mints per wallet.';
      } else if (errorData.includes('Only WL addresses allowed.')) {
        // Wallet not whitelisted
        msg = 'Wallet not on whitelist. Only whitelisted wallet addresses are currently permitted.';
      } else if (errorData.includes('transfer caller is not owner nor approved')) {
        // Wallet not approved to use functionality
        msg = 'Wallet has not been approved to use this functionality.';
      } else if (errorData.includes('Character with these traits already minted')) {
        // Character already minted
        msg = 'A character with selected traits has already been minted.';
      } else if (errorData.includes('valid recovery code')) {
        // Problem with embedded signature
        msg = 'Problem with embedded wallet';
      } else if (
        errorData.includes('user rejected transaction') ||
        errorData.includes('User rejected the request')
      ) {
        // User rejected the transaction
        msg = 'Transaction was rejected.';
      } else {
        // Blockchain communication error
        msg = 'Blockchain error. Please retry or contact support if the issue persists.';
      }

      message.error(msg);
    }
  }

  return {
    contract,
    contractError,
    getTokenUri,
    initContract,
  };
}
