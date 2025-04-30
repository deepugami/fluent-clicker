// src/App.jsx
import React, { useState, useEffect } from 'react';
import { Howl } from 'howler';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';

import './index.css';
import {
  HIGH_SCORE_ADDRESS,
  HIGH_SCORE_ABI,
  BADGE_ADDRESS,
  BADGE_ABI
} from './constants';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

// ─── Quiz Questions Pool ───────────────────────────────────
const QUIZ_POOL = [
  { q: "What does Fluent's L2 support?", opts: ["Only EVM", "Only WASM", "EVM + WASM + SVM", "Only SVM"], ans: 2 },
  { q: "Fluent's chain ID for devnet is:", opts: ["1", "20993", "1337", "80001"], ans: 1 },
  { q: "Fluent's RPC endpoint for devnet is:", opts: ["https://rpc.dev.gblend.xyz/", "https://api.fluent.xyz", "https://rpc.mainnet.fluent.xyz", "https://devnet.solana.com"], ans: 0 },
  { q: "Fluent’s account abstraction follows which EIP?", opts: ["EIP-1559", "EIP-4337", "EIP-20", "EIP-712"], ans: 1 },
  { q: "Which of these is a Fluent feature?", opts: ["Gasless transactions", "No smart contracts", "Centralized consensus", "No zk proofs"], ans: 0 },
  { q: "Fluent’s native token symbol is:", opts: ["FLU", "FLT", "ETH", "XYZ"], ans: 1 },
  { q: "Blended VM means support for:", opts: ["Only WASM", "Only EVM", "Multiple VMs", "No VMs"], ans: 2 },
  { q: "Fluent docs URL is:", opts: ["https://docs.fluent.xyz/", "https://fluent.com/docs", "https://xyz.fluent/docs", "https://docs.blockchain.xyz"], ans: 0 },
  { q: "Fluent’s zk-tech is for:", opts: ["Privacy proofs", "Faster UI", "Audio", "None"], ans: 0 },
  { q: "Devnet explorer is:", opts: ["explorer.fluent.xyz","blockscout.dev.gblend.xyz","dev.blockscout.com","etherscan.dev"], ans: 1 },
  { q: "Monorepo hosts at:", opts: ["GitHub","GitLab","Bitbucket","Sourceforge"], ans: 0 },
  { q: "Tutorials at:", opts: ["docs.fluent.xyz","blog.solana.com","developer.tron.network","docs.ethereum.org"], ans: 0 }
];

function App() {
  // ─── Game State ─────────────────────────────────────────
  const [score, setScore]           = useState(0);
  const [clickValue, setClickValue] = useState(1);
  const [autoCount, setAutoCount]   = useState(0);             // <— re-added here

  // ─── Sound ───────────────────────────────────────────────
  const [clickSound, setClickSound] = useState();
  useEffect(() => {
    setClickSound(new Howl({ src: ['/click.mp3'] }));
  }, []);

  // ─── Solana Wallet ───────────────────────────────────────
  const { publicKey: solPublicKey } = useWallet();

  // ─── EVM Wallet & On-chain Best ─────────────────────────
  const [userAddress, setUserAddress] = useState('');
  const [provider, setProvider]       = useState(null);
  const [signer, setSigner]           = useState(null);
  const [onChainBest, setOnChainBest] = useState(0);

  // ─── Quiz State ──────────────────────────────────────────
  const [quizOpen, setQuizOpen]       = useState(false);
  const [quizQ, setQuizQ]             = useState(null);
  const [triesLeft, setTriesLeft]     = useState(5);

  // ─── Attempts Tracking ───────────────────────────────────
  useEffect(() => {
    if (!userAddress) return;
    const key = `fluentQuiz_${userAddress}`;
    const rec = JSON.parse(localStorage.getItem(key) || 'null');
    if (!rec || Date.now() - rec.ts > 12 * 3600e3) {
      localStorage.setItem(key, JSON.stringify({ tries:5, ts: Date.now() }));
      setTriesLeft(5);
    } else {
      setTriesLeft(rec.tries);
    }
  }, [userAddress]);

  const decrementTry = () => {
    const key = `fluentQuiz_${userAddress}`;
    const rec = JSON.parse(localStorage.getItem(key));
    const newT = rec.tries - 1;
    localStorage.setItem(key, JSON.stringify({ tries:newT, ts: rec.ts }));
    setTriesLeft(newT);
  };

  // ─── Auto-click Loop ─────────────────────────────────────
  useEffect(() => {
    if (autoCount > 0) {
      const id = setInterval(() => setScore(s => s + autoCount), 1000);
      return () => clearInterval(id);
    }
  }, [autoCount]);

  // ─── Network & Account Changes ───────────────────────────
  useEffect(() => {
    if (!window.ethereum) return;
    const reload = () => window.location.reload();
    window.ethereum.on('chainChanged', reload);
    window.ethereum.on('accountsChanged', (ac) => {
      if (ac.length === 0) setUserAddress('');
    });
    return () => {
      window.ethereum.removeListener('chainChanged', reload);
      window.ethereum.removeListener('accountsChanged', () => {});
    };
  }, []);

  // ─── Connect & Switch EVM Wallet ────────────────────────
  const connectEvmWallet = async () => {
    console.log('Connect button clicked');
    if (!window.ethereum) {
      alert('Install MetaMask/Rabby');
      return;
    }
    try {
      const [addr] = await window.ethereum.request({ method:'eth_requestAccounts' });
      console.log('Got accounts:', addr);
      setUserAddress(addr);
      await window.ethereum.request({
        method:'wallet_switchEthereumChain',
        params:[{chainId:'0x5201'}]
      });
      const prov = new ethers.BrowserProvider(window.ethereum);
      setProvider(prov);
      setSigner(await prov.getSigner());
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  };

  // ─── Fetch On-chain Best ─────────────────────────────────
  useEffect(() => {
    const fetchBest = async() => {
      if (!signer || !userAddress) {
        setOnChainBest(0);
        return;
      }
      const c = new ethers.Contract(HIGH_SCORE_ADDRESS, HIGH_SCORE_ABI, signer);
      try {
        const b = await c.best(userAddress);
        setOnChainBest(Number(b.toString()));
      } catch (e) {
        console.warn('fetchBest error', e);
      }
    };
    fetchBest();
  }, [signer, userAddress]);

  // ─── Show Quiz then Submit ───────────────────────────────
  const handleSubmitClick = () => {
    console.log('Submit High Score clicked');
    if (!signer) { alert('Connect wallet first'); return; }
    if (triesLeft < 1) {
      alert('No tries left—try again later.');
      return;
    }
    setQuizQ(QUIZ_POOL[Math.floor(Math.random() * QUIZ_POOL.length)]);
    setQuizOpen(true);
  };

  // ─── User Answers Quiz ───────────────────────────────────
  const onAnswer = async (idx) => {
    const c = new ethers.Contract(HIGH_SCORE_ADDRESS, HIGH_SCORE_ABI, signer);
    if (idx === quizQ.ans) {
      console.log('Quiz correct');
      setQuizOpen(false);
      setOnChainBest(await c.best(userAddress).then(b=>Number(b.toString())));
      try {
        const tx = await c.submit(score);
        alert(`🚀 Tx sent: ${tx.hash}`);
        await tx.wait();
        alert('🎉 Score recorded!');
        setOnChainBest(await c.best(userAddress).then(b=>Number(b.toString())));
      } catch (e) {
        console.error('submitScore error', e);
        if (e.code === 'CALL_EXCEPTION' && e.revert?.args?.[0] === 'Not a new high') {
          alert("😕 You haven't beaten your previous high score yet. Keep clicking!");
        } else if (e.code === 'ACTION_REJECTED') {
          alert('✋ Transaction rejected by user.');
        } else {
          alert('Submit failed: ' + (e.message || e));
        }
      }
    } else {
      console.log('Quiz wrong');
      decrementTry();
      alert(`❌ Wrong answer! ${triesLeft-1} tries left. See https://docs.fluent.xyz/ for help.`);
      if (triesLeft-1 > 0) {
        setQuizQ(QUIZ_POOL[Math.floor(Math.random() * QUIZ_POOL.length)]);
      } else {
        setQuizOpen(false);
      }
    }
  };

  // ─── Badge Bonus ─────────────────────────────────────────
  useEffect(() => {
    const checkBadge = async () => {
      if (!signer || !userAddress) return;
      try {
        const c = new ethers.Contract(BADGE_ADDRESS, BADGE_ABI, signer);
        const bal = await c.balanceOf(userAddress);
        if (bal > 0n) setClickValue(v => v + 5);
      } catch (e) {
        console.warn('checkBadge error', e);
      }
    };
    checkBadge();
  }, [signer, userAddress]);

  return (
    <div className="app-container">
      {userAddress && (
        <div className="high-score-box">
          On-chain Best: {onChainBest}
        </div>
      )}

      <h1>Fluent Clicker</h1>

      <motion.div
        className="score"
        animate={{ scale:[1,1.05,1] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        Energy: {score}
      </motion.div>

      {/* Blend Me Button */}
      <motion.button
        className="blend-button"
        onClick={() => {
          console.log('Blend button clicked');
          setScore(s => s + clickValue);
          clickSound?.play();
        }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        Blend me
      </motion.button>

      <div>
        <button className="shop-button" onClick={() => {
          const cost = 10 * clickValue;
          if (score >= cost) {
            setScore(s => s - cost);
            setClickValue(v => v + 1);
          }
        }}>
          +1 Click (Cost: {10 * clickValue})
        </button>
        <button className="shop-button" onClick={() => {
          const cost = 50 * (autoCount + 1);
          if (score >= cost) {
            setScore(s => s - cost);
            setAutoCount(c => c + 1);
          }
        }}>
          Drone (+{autoCount}/s) (Cost: {50 * (autoCount + 1)})
        </button>
      </div>

      <button className="wallet-button" onClick={connectEvmWallet}>
        {userAddress
          ? `${userAddress.slice(0,6)}...${userAddress.slice(-4)}`
          : 'Connect EVM Wallet'}
      </button>

      <div style={{ marginTop: '.5rem' }}>
        <WalletMultiButton />
      </div>

      <button
        className="shop-button"
        style={{ marginTop: '1rem' }}
        onClick={handleSubmitClick}
        disabled={!signer}
      >
        Submit High Score
      </button>

      <div className="footer-credit">
        Made with ❤️ by <a href="https://www.x.com/deepugami" target="_blank" rel="noopener noreferrer">@deepugami</a>
      </div>

      {/* Quiz Modal */}
      {quizOpen && quizQ && (
        <div className="quiz-overlay">
          <div className="quiz-box">
            <div className="quiz-question">{quizQ.q}</div>
            <div className="quiz-options">
              {quizQ.opts.map((o,i) => (
                <button key={i} onClick={() => onAnswer(i)}>{o}</button>
              ))}
            </div>
            <div className="quiz-footer">
              Attempts left: {triesLeft}<br/>
              Need help? <a href="https://docs.fluent.xyz/" target="_blank" rel="noopener noreferrer">Fluent Docs</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
