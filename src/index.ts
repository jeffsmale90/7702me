#!/usr/bin/env node

import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http, extractChain, type Hex } from "viem";
import { sepolia, lineaSepolia } from "viem/chains";
import { confirm } from "@inquirer/prompts";

async function main(): Promise<void> {
  // Get command line arguments
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    console.error(
      "Usage: node index.js <privateKey> <delegateAddress> <chainId>"
    );
    process.exit(1);
  }

  const [privateKey, delegateAddress, chainId] = args;

  try {
    // Derive account from private key
    const account = privateKeyToAccount(privateKey as Hex);
    console.log(`\nDerived account address: ${account.address}`);

    // Ask for confirmation
    const shouldProceed = await confirm({
      message: "Are you sure you want to upgrade this account with EIP-7702?",
      default: false,
    });

    if (!shouldProceed) {
      console.log("Operation cancelled by user");
      process.exit(0);
    }

    const chain = extractChain({
      chains: [sepolia, lineaSepolia],
      id: Number(chainId) as 11155111 | 59141,
    });

    if (chain === undefined) {
      console.error(`Chain with ID ${chainId} not found`);
      process.exit(1);
    }

    // Create wallet client
    const client = createWalletClient({
      account,
      chain,
      transport: http(),
    });

    // Sign authorization
    console.log("\nSigning EIP-7702 authorization...");
    const authorization = await client.signAuthorization({
      account,
      contractAddress: delegateAddress as Hex,
    });

    // Send transaction with authorization
    console.log("\nSending transaction with authorization...");
    const hash = await client.sendTransaction({
      authorizationList: [authorization],
    });

    console.log(`\nTransaction sent! Hash: ${hash}`);
    console.log(
      `\nAccount ${account.address} has been upgraded with EIP-7702 to delegate to ${delegateAddress}`
    );
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
