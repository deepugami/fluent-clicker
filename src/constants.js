// src/constants.js

export const FLUENT_RPC_URL     = 'https://rpc.dev.gblend.xyz/';
export const HIGH_SCORE_ADDRESS = '0x1E55Fc14dd3DE8596FE5A355649767A157E6206b';
export const BADGE_ADDRESS      = '0xC826a3E4A4C1a32117056951F426294eFCBE3a81';

export const HIGH_SCORE_ABI = [
  'function submit(uint256 score) external',
  'function best(address) view returns (uint256)'
];

export const BADGE_ABI = [
  'function balanceOf(address owner) view returns (uint256)'
];