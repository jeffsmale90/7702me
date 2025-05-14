#!/usr/bin/env node

import { privateKeyToAccount } from "viem/accounts";
import {
  createWalletClient,
  createPublicClient,
  http,
  extractChain,
  Hex,
  PublicClient,
  isAddressEqual,
  Address,
  isAddress,
  isHex,
} from "viem";
import { sepolia, lineaSepolia } from "viem/chains";
import { confirm } from "@inquirer/prompts";

type ChainId = typeof sepolia.id | typeof lineaSepolia.id;

interface ParsedArgs {
  privateKey: Hex;
  targetDelegateAddress: Address;
  chainId: ChainId;
}

function parseArgs(args: string[]): ParsedArgs {
  if (args.length !== 3) {
    console.error(
      "Usage: node index.js <privateKey> <delegateAddress> <chainId>"
    );
    process.exit(1);
  }

  const [privateKey, targetDelegateAddress, chainId] = args;

  if (!isHex(privateKey)) {
    throw new Error(
      "Invalid private key format. Must be 64 hex characters without 0x prefix."
    );
  }

  if (!isAddress(targetDelegateAddress)) {
    throw new Error(
      "Invalid delegate address format. Must be a valid Ethereum address with 0x prefix."
    );
  }

  const numericChainId = Number(chainId) as ChainId;
  if (![sepolia.id, lineaSepolia.id].includes(numericChainId)) {
    throw new Error(
      `Invalid chain ID. Must be one of: ${sepolia.id} (Sepolia) or ${lineaSepolia.id} (Linea Sepolia)`
    );
  }

  return {
    privateKey: privateKey as Hex,
    targetDelegateAddress: targetDelegateAddress as Address,
    chainId: numericChainId as ChainId,
  };
}

type DelegationInformation =
  | {
      isDelegated: false;
    }
  | {
      isDelegated: true;
      delegatedAddress: Address;
    };

async function getDelegationInformation({
  client,
  address,
}: {
  client: PublicClient;
  address: Hex;
}): Promise<DelegationInformation> {
  const code = await client.getCode({ address });

  if (!code || code === "0x") {
    return { isDelegated: false };
  }

  if (!code.startsWith("0xef0100")) {
    throw new Error("Account is a contract and cannot be delegated to");
  }

  const delegatedAddress = `0x${code.slice(8)}` as Address;
  return { isDelegated: true, delegatedAddress };
}

async function main(): Promise<void> {
  try {
    const { privateKey, targetDelegateAddress, chainId } = parseArgs(
      process.argv.slice(2)
    );

    const account = privateKeyToAccount(privateKey);

    const chain = extractChain({
      chains: [sepolia, lineaSepolia],
      id: chainId,
    });

    if (chain === undefined) {
      console.error(`Chain with ID ${chainId} not found`);
      process.exit(1);
    }

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    });

    const beforeDelegationInformation = await getDelegationInformation({
      client: publicClient,
      address: account.address,
    });

    const shouldProceed = await confirm({
      message: `Are you sure you want to delegate ${
        account.address
      } to ${targetDelegateAddress}? ${
        beforeDelegationInformation.isDelegated
          ? `\n\n(Account is already delegated to ${beforeDelegationInformation.delegatedAddress})`
          : ""
      }`,
      default: false,
    });

    if (!shouldProceed) {
      console.log("Operation cancelled by user");
      process.exit(0);
    }

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(),
    });

    console.log("\nSigning EIP-7702 authorization...");
    const authorization = await walletClient.signAuthorization({
      account,
      contractAddress: targetDelegateAddress,
    });

    console.log("\nSending transaction with authorization...");
    const hash = await walletClient.sendTransaction({
      authorizationList: [authorization],
      to: "0x0000000000000000000000000000000000000000",
      data: "0x",
      value: 0n,
    });

    console.log("\nWaiting for transaction to be finalized...");
    await publicClient.waitForTransactionReceipt({ hash });

    console.log("\nVerifying delegation...");
    const afterDelegationInformation = await getDelegationInformation({
      client: publicClient,
      address: account.address,
    });

    if (
      !afterDelegationInformation.isDelegated ||
      !isAddressEqual(
        afterDelegationInformation.delegatedAddress,
        targetDelegateAddress
      )
    ) {
      throw new Error(
        "Delegation verification failed. The account was not properly delegated."
      );
    }

    console.log(
      `\nAccount ${account.address} has been successfully upgraded with EIP-7702 to delegate to ${targetDelegateAddress}`
    );
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
