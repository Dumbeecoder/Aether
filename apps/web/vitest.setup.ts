// Dummy values only — no test in this suite ever makes a real network call
// to these addresses (see lib/web3/*.test.ts: transaction builders are
// tested for correct *encoding*, not executed against a live RPC, which
// isn't reachable from this environment anyway).
process.env.NEXT_PUBLIC_ERC8183_COMMERCE ??= "0xa206c0517b6371c6638cd9e4a42cc9f02a33b0de";
process.env.NEXT_PUBLIC_ERC8183_ROUTER ??= "0xd7d36d66d2f1b608a0f943f722d27e3744f66f25";
process.env.NEXT_PUBLIC_ERC8183_POLICY ??= "0x4f4678d4439fec812ac7674bb3efb4c8f5fb78a6";
process.env.NEXT_PUBLIC_ERC8004_REGISTRY ??= "0x8004A818BFB912233c491871b3d84c89A494BD9e";
process.env.NEXT_PUBLIC_RPC_URL ??= "https://data-seed-prebsc-1-s1.binance.org:8545";
