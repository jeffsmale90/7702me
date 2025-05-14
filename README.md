# 7702me

Note: this is for development purposes only and should not be used with real accounts or mainnets.

A CLI tool for upgrading Ethereum accounts with EIP-7702 on testnets.

See https://eip7702.io/ for details on the EIP.

## Installation

```bash
npm install -g 7702me
```

## Usage

```bash
7702me <privateKey> <delegateAddress> <chainId>
```

### Parameters

- `privateKey`: The private key of the account to upgrade (without 0x prefix)
- `delegateAddress`: The address of the contract to delegate to
- `chainId`: The chain ID where the transaction will be sent

### Example

```bash
7702me 0xREDACTED-PRIVATE-KEY 0x1234567890123456789012345678901234567890 1
```

## What it does

1. Derives the Ethereum account from the provided private key
2. Shows the derived address and asks for confirmation
3. Signs an EIP-7702 authorization to the specified delegate address
4. Sends an empty type 4 transaction with the signed authorization

## Security Note

Never share your private keys with anyone. This tool should be used with caution, and only works with Sepolia or Linea Sepolia testnets.
