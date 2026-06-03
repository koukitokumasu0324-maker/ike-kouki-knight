/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Zap,
  Sword,
  Wand,
  Users,
  Award,
  Sparkles,
  Info
} from "lucide-react";

// ==========================================
// 🎮 かんたん調整用ゲームパラメータ（Antigravity等でここを書き換えて調整してね）
// ==========================================

// こーきナイトの基本攻撃力
const INITIAL_TAP_DAMAGE = 1;

// 武器（Item 1）の攻撃力増加幅：1レベルあたり +3攻撃力される
const WEAPON_DMG_PER_LV = 3;

// 魔法のつえ（Item 2）の攻撃力増加幅：1レベルあたり +20攻撃力される（めちゃくちゃつよい！）
const WAND_DMG_PER_LV = 20;

// 魔法使い仲間（Item 3）の攻撃力：1レベルあたり、1秒に自動で 5ダメージを与える
const MAGE_DPS_PER_LV = 5;

// ==========================================
// 🔊 レトロサウンド効果音（Web Audio API）
// 外部ファイル不要でピコピコ音が鳴ります
// ==========================================
class SfxPlayer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {}

  setMute(muted: boolean) {
    this.isMuted = muted;
  }

  private init() {
    if (!this.ctx) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
      } catch (e) {
        console.error("AudioContextの起動に失敗しました:", e);
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  // こうげきしたとき（剣でバシッ！）
  playHit() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    // 短い三角波で物理アタック音
    osc.type = "triangle";
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }

  // 魔法・仲間がこうげきしたとき（ピロリロリン✨）
  playMagic() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(2200, now + 0.15);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  // コインをゲットしたとき（ピキーン🪙）
  playCoin() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = "sine";
    // 2つの高音を連続で鳴らすことでファミコン風コイン音
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.08);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.22);

    osc.start(now);
    osc.stop(now + 0.23);
  }

  // パワーアップしたとき（テレレレレーン！🌟）
  playUpgrade() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // ド、ミ、ソ、ド（Cメジャー）
    
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = "triangle";
      const startTime = now + idx * 0.06;

      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, startTime);
      gain.gain.linearRampToValueAtTime(0.01, startTime + 0.12);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.12);
    });
  }

  // 敵をたおしたとき（ボゴォォォン！💥）
  playDefeat() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    // のこぎり波を急速降下させて大爆発を表現
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.35);

    osc.start(now);
    osc.stop(now + 0.36);
  }

  // つよいボスが出たとき（ドドン！👿）
  playBossEnter() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.8);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.8);

    osc.start(now);
    osc.stop(now + 0.8);
  }

  // 魔王をたおして全面クリアしたとき（ドレミファソラシド豪華ファンファーレ👑）
  playGameClear() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50, 1318.51, 1567.98]; 
    
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = "sine";
      const startTime = now + idx * 0.08;

      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, startTime);
      gain.gain.linearRampToValueAtTime(0.01, startTime + 0.3);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }
}

// 効果音プレイヤーのグローバルインスタンス
const sfx = new SfxPlayer();

// ==========================================
// 👾 基本の敵モンスター配置データベース
// ステージ10まで順に登場。以降は無限ループ＆インフレ
// ==========================================
interface BaseMonster {
  name: string;
  emoji: string;
  baseHp: number;
  reward: number;
  color: string;
}

const MONSTER_DATABASE: BaseMonster[] = [
  { name: "プルプル スライム", emoji: "💧", baseHp: 12, reward: 5, color: "from-blue-600/30 to-cyan-500/10" },
  { name: "おさんぽ いもむし", emoji: "🐛", baseHp: 28, reward: 12, color: "from-green-600/30 to-emerald-500/10" },
  { name: "やんちゃ コウモリ", emoji: "🦇", baseHp: 60, reward: 28, color: "from-purple-600/30 to-fuchsia-500/10" },
  { name: "いたずら ゴブリン", emoji: "👺", baseHp: 140, reward: 60, color: "from-orange-600/30 to-amber-500/10" },
  { name: "カチコチ ゴーレム", emoji: "🗿", baseHp: 320, reward: 130, color: "from-zinc-600/40 to-slate-500/20" },
  { name: "ドクドク フラワー", emoji: "🥀🐍", baseHp: 750, reward: 280, color: "from-emerald-700/30 to-rose-500/10" },
  { name: "のろいミイラ おとこ", emoji: "🧟", baseHp: 1600, reward: 600, color: "from-yellow-700/30 to-orange-600/10" },
  { name: "わるいまほうピエロ", emoji: "🤡🔮", baseHp: 3500, reward: 1300, color: "from-fuchsia-700/30 to-violet-500/10" },
  { name: "でんげきフェニックス", emoji: "🦅⚡", baseHp: 8000, reward: 2800, color: "from-indigo-600/30 to-blue-500/10" },
  { name: "【まおう】アルティメットドラゴン", emoji: "🐉🔥👿", baseHp: 20000, reward: 8000, color: "from-red-950 via-zinc-900 to-black" },
];

export default function App() {
  // ==========================================
  // 💾 セーブデータ用のReactステート（ローカルストレージ連携）
  // ==========================================
  const [gold, setGold] = useState<number>(0);
  const [stage, setStage] = useState<number>(1);
  const [highestStage, setHighestStage] = useState<number>(1);

  // パワーアップアイテムの「レベル」
  const [weaponLevel, setWeaponLevel] = useState<number>(0); // ぶき: level 0 = 木のえだ
  const [wandLevel, setWandLevel] = useState<number>(0);     // 魔法のつえ: level 0 = なし
  const [companionLevel, setCompanionLevel] = useState<number>(0); // なかま: level 0 = なし

  // ==========================================
  // ⚔️ ゲーム内バトル演出用ステート
  // ==========================================
  const [enemyHp, setEnemyHp] = useState<number>(12);
  const [shaking, setShaking] = useState<boolean>(false);
  const [damagePopups, setDamagePopups] = useState<Array<{ id: number; text: string; x: number; y: number; color: string; isCrit: boolean }>>([]);
  const [combo, setCombo] = useState<number>(0);
  const [scatteredCoins, setScatteredCoins] = useState<Array<{ id: number; x: string; y: string }>>([]);
  const [defeated, setDefeated] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);

  // 特殊VFX演出
  const [slashEffect, setSlashEffect] = useState<{ active: boolean; x: number; y: number } | null>(null);
  const [magicEffect, setMagicEffect] = useState<{ active: boolean; x: number; y: number } | null>(null);
  const [upgradeAura, setUpgradeAura] = useState<boolean>(false);

  // ポップアップウインドウ表示ステート
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showVictoryGate, setShowVictoryGate] = useState<boolean>(false);
  const [showInfo, setShowInfo] = useState<boolean>(false);

  // コンボタイマーの管理
  const comboTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ==========================================
  // 📐 計算ロジック（パワー基準値）
  // ==========================================

  // 今のステージの敵データを取得
  const getMonsterForStage = (s: number) => {
    const isBoss = s % 10 === 0;
    const loop = Math.floor((s - 1) / 10);
    const baseIndex = (s - 1) % 10;
    const base = MONSTER_DATABASE[baseIndex];

    // ループ（周回）ごとにHPと報酬コインを大幅にインフレさせる
    const hpMultiplier = Math.pow(2.8, loop);
    const goldMultiplier = Math.pow(2.4, loop);

    const maxHp = Math.round(base.baseHp * hpMultiplier);
    const reward = Math.round(base.reward * goldMultiplier);

    let name = base.name;
    let emoji = base.emoji;
    let bg = base.color;

    // 2周目以降（ステージ11以上）の装飾
    if (loop > 0) {
      if (isBoss) {
        name = `【しん・まおう (★${loop + 1})】 デスドラゴン`;
        emoji = "🐉👿⛈️";
        bg = "from-red-950 via-purple-900 to-black";
      } else {
        name = `（うら：${loop}周め） ${base.name}`;
      }
    }

    return { name, emoji, maxHp, reward, bg, isBoss };
  };

  const currentMonster = getMonsterForStage(stage);

  // こうきの攻撃力 ＝ (基本 1) ＋ (武器LV × WEAPON_DMG_PER_LV) ＋ (まほうつえLV × WAND_DMG_PER_LV)
  const tapDamage = INITIAL_TAP_DAMAGE + weaponLevel * WEAPON_DMG_PER_LV + wandLevel * WAND_DMG_PER_LV;

  // 1秒あたりの自動ダメージ (DPS) ＝ なかまのレベル × MAGE_DPS_PER_LV
  const dps = companionLevel * MAGE_DPS_PER_LV;

  // 各アップグレードの名称・次レベルの効果・必要ゴールドを計算するヘルパー
  const getWeaponInfo = (lv: number) => {
    const weapons = [
      "木のえだ 🪵",
      "ひのつるぎ ⚔️🔥",
      "こおりのせいけん ⚔️🧊",
      "かぜのツインブレード ⚔️🌀",
      "いなずまの神剣 ⚔️⚡",
      "こうき専用のせいけん ✨👑⚔️"
    ];
    const name = lv < weapons.length ? weapons[lv] : `でんせつのつるぎ＋${lv - weapons.length + 1} 🌟`;
    const dmg = INITIAL_TAP_DAMAGE + lv * WEAPON_DMG_PER_LV;
    const nextDmg = INITIAL_TAP_DAMAGE + (lv + 1) * WEAPON_DMG_PER_LV;
    const cost = Math.floor(10 * Math.pow(1.5, lv));
    return { name, dmg, nextDmg, cost };
  };

  const getWandInfo = (lv: number) => {
    const wands = [
      "もっていない ❌",
      "まほうのつえ 🪄",
      "インフェルノロッド 🔥🪄",
      "スターダストロッド 🌌🪄",
      "ルーンのせい杖 🔮🪄",
      "こうき極光のうつわ ☀️🪄"
    ];
    const name = lv < wands.length ? wands[lv] : `でんせつ魔杖＋${lv - wands.length + 1} ✨`;
    const dmg = lv * WAND_DMG_PER_LV;
    const nextDmg = (lv + 1) * WAND_DMG_PER_LV;
    const cost = Math.floor(80 * Math.pow(1.65, lv));
    return { name, dmg, nextDmg, cost };
  };

  const getCompanionInfo = (lv: number) => {
    const helpers = [
      "だれもいない ❌",
      "みならいまどうし 🧙‍♂️",
      "べんきょうちゅう妖精 🧚‍♀️",
      "でんせつのけんじゃ 🧙",
      "てんしのサポーター 👼✨",
      "光のガーディアンレオン 🦁👑"
    ];
    const name = lv < helpers.length ? helpers[lv] : `なかまマスター＋${lv - helpers.length + 1} 🤝`;
    const companionDps = lv * MAGE_DPS_PER_LV;
    const nextDps = (lv + 1) * MAGE_DPS_PER_LV;
    const cost = Math.floor(150 * Math.pow(1.75, lv));
    return { name, dps: companionDps, nextDps, cost };
  };

  // ==========================================
  // 🔄 セーブデータロード
  // ==========================================
  useEffect(() => {
    const savedGold = localStorage.getItem("koki_rpg_gold");
    const savedStage = localStorage.getItem("koki_rpg_stage");
    const savedHighest = localStorage.getItem("koki_rpg_highest");
    const savedWeapon = localStorage.getItem("koki_rpg_weapon");
    const savedWand = localStorage.getItem("koki_rpg_wand");
    const savedCompanion = localStorage.getItem("koki_rpg_companion");
    const savedMuted = localStorage.getItem("koki_rpg_muted");

    if (savedGold !== null) setGold(Number(savedGold));
    if (savedStage !== null) {
      const s = Number(savedStage);
      setStage(s);
      setEnemyHp(getMonsterForStage(s).maxHp);
    } else {
      // 初期化
      setEnemyHp(getMonsterForStage(1).maxHp);
    }
    if (savedHighest !== null) setHighestStage(Number(savedHighest));
    if (savedWeapon !== null) setWeaponLevel(Number(savedWeapon));
    if (savedWand !== null) setWandLevel(Number(savedWand));
    if (savedCompanion !== null) setCompanionLevel(Number(savedCompanion));
    if (savedMuted !== null) {
      const m = savedMuted === "true";
      setMuted(m);
      sfx.setMute(m);
    }
  }, []);

  // ==========================================
  // 🧙‍♂️ なかま（じどう攻撃）のダメージクロック
  // 1秒に1回、なかまが自動でダメージを与える
  // ==========================================
  useEffect(() => {
    if (dps <= 0 || defeated) return;

    const interval = setInterval(() => {
      // 攻撃演出
      setShaking(true);
      setTimeout(() => setShaking(false), 200);

      sfx.playMagic();

      // モンスターの位置に魔法エフェクト
      setMagicEffect({
        active: true,
        x: 20 + Math.random() * 60,
        y: 20 + Math.random() * 60,
      });
      setTimeout(() => setMagicEffect(null), 400);

      // 紫色のダメージ数字をポップアップ
      const popupId = Date.now() + Math.random();
      const px = 20 + Math.random() * 60;
      const py = 30 + Math.random() * 40;

      setDamagePopups((prev) => [
        ...prev,
        {
          id: popupId,
          text: `🧙‍♂️しょうかん！ -${dps}`,
          x: px,
          y: py,
          color: "text-purple-400 font-extrabold text-xl shadow-fuchsia-900 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]",
          isCrit: false,
        },
      ]);

      setTimeout(() => {
        setDamagePopups((prev) => prev.filter((p) => p.id !== popupId));
      }, 800);

      // 体力を減らす
      setEnemyHp((prev) => {
        const next = prev - dps;
        if (next <= 0) {
          handleEnemyDefeat();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [dps, defeated, stage]);

  // ==========================================
  // 剣アタック！タップしたとき
  // ==========================================
  const handleTapAttack = (clientX?: number, clientY?: number) => {
    if (defeated) return;

    // 音を再生して、敵モンスターをふるわせる
    sfx.playHit();
    setShaking(true);
    setTimeout(() => setShaking(false), 200);

    // コンボカウンターを増やす（1.5秒タップし続ければコンボ継続）
    setCombo((prev) => prev + 1);
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => {
      setCombo(0);
    }, 1500);

    // コンボボーナス（1コンボあたり +5% ダメージ、最高2倍）
    const comboMultiplier = Math.min(2.0, 1 + combo * 0.05);
    // 確率でクリティカル（15% または 5の倍数コンボでクリティカル！）
    const isCrit = (combo + 1) % 5 === 0 && combo > 0;
    const finalDamage = Math.round(tapDamage * comboMultiplier * (isCrit ? 1.5 : 1.0));

    // タップ位置に合わせて斬撃エフェクト
    let vfxX = 50;
    let vfxY = 45;
    const hitBox = document.getElementById("monster-hit-box");
    if (clientX && hitBox) {
      const rect = hitBox.getBoundingClientRect();
      vfxX = ((clientX - rect.left) / rect.width) * 100;
      vfxY = ((clientY - rect.top) / rect.height) * 100;
    } else {
      vfxX = 30 + Math.random() * 40;
      vfxY = 30 + Math.random() * 40;
    }

    setSlashEffect({ active: true, x: vfxX, y: vfxY });
    setTimeout(() => setSlashEffect(null), 300);

    // 飛び出すダメージテキスト
    const popupId = Date.now() + Math.random();
    setDamagePopups((prev) => [
      ...prev,
      {
        id: popupId,
        text: isCrit ? `🔥会心の一撃！ -${finalDamage}` : `⚔️ -${finalDamage}`,
        x: vfxX,
        y: vfxY,
        color: isCrit
          ? "text-rose-400 font-extrabold text-3xl drop-shadow-[0_4px_6px_rgba(0,0,0,1)] scale-110 tracking-wider"
          : "text-yellow-300 font-black text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,1)]",
        isCrit,
      },
    ]);

    setTimeout(() => {
      setDamagePopups((prev) => prev.filter((p) => p.id !== popupId));
    }, 800);

    // 敵HPの減算
    setEnemyHp((prev) => {
      const next = prev - finalDamage;
      if (next <= 0) {
        handleEnemyDefeat();
        return 0;
      }
      return next;
    });
  };

  // ==========================================
  // 敵モンスターをたおした！
  // ==========================================
  const handleEnemyDefeat = () => {
    setDefeated(true);
    sfx.playDefeat();

    // コインをまわりに飛び散らせる！
    const coinsCount = 12;
    const coinElements = Array.from({ length: coinsCount }).map((_, idx) => {
      const angle = (idx / coinsCount) * 2 * Math.PI + (Math.random() * 0.4 - 0.2);
      const distance = 80 + Math.random() * 100; // 飛び散る距離
      return {
        id: idx + Math.random(),
        x: `${Math.cos(angle) * distance}px`,
        y: `${Math.sin(angle) * distance}px`,
      };
    });
    setScatteredCoins(coinElements);

    // コインを連続で拾ったような「ファファファッポコピコ」というレトロ風効果音
    setTimeout(() => sfx.playCoin(), 150);
    setTimeout(() => sfx.playCoin(), 300);
    setTimeout(() => sfx.playCoin(), 450);

    const monsterInfo = getMonsterForStage(stage);

    // 1秒後に次のモンスターを表示
    setTimeout(() => {
      // お金の加算とセーブ
      setGold((prev) => {
        const nextGold = prev + monsterInfo.reward;
        localStorage.setItem("koki_rpg_gold", String(nextGold));
        return nextGold;
      });

      // 次のステージへ
      const nextStage = stage + 1;
      setStage(nextStage);
      localStorage.setItem("koki_rpg_stage", String(nextStage));

      // ハイスコア（最高ステージ）を更新
      setHighestStage((prev) => {
        const nextHigh = Math.max(prev, nextStage);
        localStorage.setItem("koki_rpg_highest", String(nextHigh));
        return nextHigh;
      });

      // 新しい敵のHPを設定
      const newMonster = getMonsterForStage(nextStage);
      setEnemyHp(newMonster.maxHp);

      // コインと撃破状態をリセット
      setScatteredCoins([]);
      setDefeated(false);

      // 魔王をはじめて倒したときはスペシャル画面
      if (stage === 10) {
        setShowVictoryGate(true);
        sfx.playGameClear();
      } else {
        // 次が魔王ボスならアラームドラム
        if (nextStage % 10 === 0) {
          sfx.playBossEnter();
        }
      }
    }, 1100);
  };

  // ==========================================
  // お店（ショップ）パワーアップ購入処理
  // ==========================================
  const upgradeWeapon = () => {
    const { cost } = getWeaponInfo(weaponLevel);
    if (gold >= cost && !defeated) {
      const nextLev = weaponLevel + 1;
      setGold((prev) => {
        const nextGold = prev - cost;
        localStorage.setItem("koki_rpg_gold", String(nextGold));
        return nextGold;
      });
      setWeaponLevel(nextLev);
      localStorage.setItem("koki_rpg_weapon", String(nextLev));
      
      // レベルアップ演出
      sfx.playUpgrade();
      setUpgradeAura(true);
      setTimeout(() => setUpgradeAura(false), 500);
    }
  };

  const upgradeWand = () => {
    const { cost } = getWandInfo(wandLevel);
    if (gold >= cost && !defeated) {
      const nextLev = wandLevel + 1;
      setGold((prev) => {
        const nextGold = prev - cost;
        localStorage.setItem("koki_rpg_gold", String(nextGold));
        return nextGold;
      });
      setWandLevel(nextLev);
      localStorage.setItem("koki_rpg_wand", String(nextLev));

      // レベルアップ演出
      sfx.playUpgrade();
      setUpgradeAura(true);
      setTimeout(() => setUpgradeAura(false), 500);
    }
  };

  const upgradeCompanion = () => {
    const { cost } = getCompanionInfo(companionLevel);
    if (gold >= cost && !defeated) {
      const nextLev = companionLevel + 1;
      setGold((prev) => {
        const nextGold = prev - cost;
        localStorage.setItem("koki_rpg_gold", String(nextGold));
        return nextGold;
      });
      setCompanionLevel(nextLev);
      localStorage.setItem("koki_rpg_companion", String(nextLev));

      // レベルアップ演出
      sfx.playUpgrade();
      setUpgradeAura(true);
      setTimeout(() => setUpgradeAura(false), 500);
    }
  };

  // ==========================================
  // ゲームリセット（最初からやりなおす）
  // ==========================================
  const resetGameData = () => {
    localStorage.clear();
    setGold(0);
    setStage(1);
    setWeaponLevel(0);
    setWandLevel(0);
    setCompanionLevel(0);
    setEnemyHp(getMonsterForStage(1).maxHp);
    setCombo(0);
    setShowResetConfirm(false);
    sfx.playHit();
  };

  // 音のON/OFF切り替え
  const toggleMute = () => {
    const nextMute = !muted;
    setMuted(nextMute);
    sfx.setMute(nextMute);
    localStorage.setItem("koki_rpg_muted", String(nextMute));
  };

  // ==========================================
  // 体力ゲージ（HPゲージ）の色判定
  // ==========================================
  const hpRatio = Math.max(0, enemyHp / currentMonster.maxHp) * 100;
  let hpColorClass = "bg-gradient-to-r from-emerald-500 to-green-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]";
  if (hpRatio < 30) {
    hpColorClass = "bg-gradient-to-r from-rose-600 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse";
  } else if (hpRatio < 65) {
    hpColorClass = "bg-gradient-to-r from-amber-500 to-yellow-400";
  }

  // お店アイテムの金額満たし判定
  const wepData = getWeaponInfo(weaponLevel);
  const wandData = getWandInfo(wandLevel);
  const compData = getCompanionInfo(companionLevel);

  return (
    <div id="game-portal" className="w-full h-dvh flex justify-center items-center bg-slate-950 font-sans text-white overflow-hidden select-none">
      {/* スマホ縦持ちに絶対最適化されたコンテナ */}
      <div className="relative w-full max-w-md h-full flex flex-col justify-between p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-gradient-to-b from-indigo-950 via-slate-900 to-purple-950 overflow-hidden shadow-2xl border-x border-indigo-500/20">
        
        {/* レトロなきらきら星背景 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-25 z-0">
          <div className="absolute top-10 left-10 text-xl animate-pulse">⭐️</div>
          <div className="absolute top-28 right-12 text-sm animate-pulse delay-75">✨</div>
          <div className="absolute top-[32%] left-[6%] text-xs animate-pulse delay-500">⭐</div>
          <div className="absolute top-[48%] right-[8%] text-lg animate-pulse delay-200">✨</div>
          <div className="absolute bottom-[35%] left-[10%] text-sm animate-pulse delay-1000">⭐️</div>
          <div className="absolute bottom-[20%] right-[15%] text-xl animate-pulse delay-300">✨</div>
        </div>

        {/* ==========================================
            🛸 ヘッダーエリア (上部固定)
            ========================================== */}
        <div className="z-10 bg-slate-950/60 backdrop-blur-md rounded-2xl p-2.5 border border-indigo-500/10 shadow-lg">
          <div className="flex justify-between items-center mb-1.5">
            {/* ゲームタイトル */}
            <h1 className="text-sm font-display tracking-wider text-pink-400 flex items-center gap-1">
              <span className="scale-110">⚔️</span> いけ！こうきナイト！
            </h1>
            
            {/* 役立ちツール・音量・初期化ボタン */}
            <div className="flex gap-2 text-xs">
              <button
                id="btn-info"
                onClick={() => setShowInfo(true)}
                className="w-7 h-7 flex items-center justify-center bg-slate-800 rounded-lg hover:bg-slate-700 text-indigo-300 transition-colors border border-indigo-500/20 active:scale-95"
              >
                <Info size={14} />
              </button>
              <button
                id="btn-volume"
                onClick={toggleMute}
                className="w-7 h-7 flex items-center justify-center bg-slate-800 rounded-lg hover:bg-slate-700 text-yellow-400 transition-colors border border-yellow-500/20 active:scale-95"
              >
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <button
                id="btn-reset"
                onClick={() => setShowResetConfirm(true)}
                className="w-7 h-7 flex items-center justify-center bg-rose-950/50 rounded-lg text-rose-300 border border-rose-500/20 hover:bg-rose-900/50 active:scale-95"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* ステージ・ハイスコア・コインのステータス */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="bg-slate-900/90 rounded-xl p-1.5 border border-indigo-500/20 flex flex-col justify-center items-center">
              <span className="text-[10px] text-indigo-300 font-bold block leading-none">いまのステージ</span>
              <span className="text-xl font-display text-yellow-300 mt-0.5">
                すてーじ {stage}
              </span>
            </div>

            <div className="bg-slate-900/90 rounded-xl p-1.5 border border-yellow-500/20 flex flex-col justify-center items-center">
              <span className="text-[10px] text-yellow-400 font-bold block leading-none">ゴールド（おかね）</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xl text-yellow-300 font-display font-black tracking-tight">
                  {gold.toLocaleString()}
                </span>
                <span className="text-base animate-bounce">🪙</span>
              </div>
            </div>
          </div>
        </div>

        {/* ==========================================
            🐉 バトル中央ステージ (モンスター・ダメージ発生)
            ========================================== */}
        <div className="z-10 flex-1 flex flex-col justify-center items-center py-2 min-h-0 relative">
          
          {/* ボグラウンド窓フレーム：魔王ステージなら禍々しく不気味に */}
          <div
            id="monster-zone"
            className={`w-full max-w-sm aspect-square max-h-[46dvh] p-4 rounded-3xl bg-gradient-to-b ${currentMonster.bg} border-4 ${
              currentMonster.isBoss ? "border-rose-600 shadow-[0_0_20px_rgba(220,38,38,0.5)] animate-pulse" : "border-indigo-400/30"
            } relative flex flex-col justify-between items-center overflow-hidden transition-all duration-500`}
          >
            {/* ボス警告 */}
            {currentMonster.isBoss && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-rose-600 text-[10px] font-display text-white px-3 py-0.5 rounded-full uppercase tracking-widest animate-bounce font-bold shadow-md shadow-black">
                ⚠️ つよいまおう ！！ ⚠️
              </div>
            )}

            {/* モンスター名表示 */}
            <div className="bg-slate-950/80 backdrop-blur-sm px-3.5 py-1.5 rounded-2xl border border-white/10 text-center shadow-lg w-full max-w-[210px] mt-1.5">
              <p className="text-xs text-indigo-300 font-bold tracking-wide">
                ステージ {stage} の てき
              </p>
              <h2 className="text-sm font-black text-white truncate mt-0.5 tracking-tight font-sans">
                {currentMonster.name}
              </h2>
            </div>

            {/* モンスター画像（巨大絵文字） */}
            <div
              id="monster-hit-box"
              onClick={(e) => handleTapAttack(e.clientX, e.clientY)}
              className="relative my-auto flex items-center justify-center w-full h-[60%] cursor-pointer select-none active:scale-95 transition-transform"
            >
              {/* レベルアップしたときのキラキラオーラ */}
              {upgradeAura && (
                <div className="absolute w-24 h-24 rounded-full bg-yellow-400/30 border border-yellow-300 upgrade-aura pointer-events-none" />
              )}

              {/* モンスター本体 */}
              <div
                className={`text-8xl sm:text-9xl select-none filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] flex items-center justify-center transform active:scale-90 transition-transform ${
                  shaking ? "shake-enemy" : ""
                } ${defeated ? "scale-50 opacity-40 blur-[1px] transition-all duration-300" : ""}`}
              >
                {currentMonster.emoji}
              </div>

              {/* コイン散らばり（たおした瞬間） */}
              {scatteredCoins.map((coin) => (
                <span
                  key={coin.id}
                  style={{ "--coin-x": coin.x, "--coin-y": coin.y } as React.CSSProperties}
                  className="absolute text-3xl coin-scatter pointer-events-none z-20"
                >
                  🪙
                </span>
              ))}

              {/* 剣の斬撃VFX */}
              {slashEffect?.active && (
                <div
                  style={{ left: `${slashEffect.x}%`, top: `${slashEffect.y}%` }}
                  className="absolute select-none pointer-events-none z-30 text-5xl font-black italic text-red-500 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] slash-effect font-display"
                >
                  ⚡⚔️
                </div>
              )}

              {/* 魔法のド迫力VFX */}
              {magicEffect?.active && (
                <div
                  style={{ left: `${magicEffect.x}%`, top: `${magicEffect.y}%` }}
                  className="absolute select-none pointer-events-none z-30 text-5xl magic-effect"
                >
                  ✨🪄💨
                </div>
              )}

              {/* フローティング・ダメージテキスト（タップ＆自動DPS） */}
              {damagePopups.map((popup) => (
                <div
                  key={popup.id}
                  style={{ left: `${popup.x}%`, top: `${popup.y}%` }}
                  className={`absolute pointer-events-none z-40 damage-pop-text select-none whitespace-nowrap ${popup.color}`}
                >
                  {popup.text}
                </div>
              ))}
            </div>

            {/* 体力バー・数字 (HP Gauge) */}
            <div className="w-full mt-auto">
              <div className="flex justify-between items-center mb-1 text-[10px] font-bold text-slate-300 px-1">
                <span>たいりょく：</span>
                <span className="font-mono text-xs">
                  {Math.max(0, enemyHp)} / {currentMonster.maxHp} HP
                </span>
              </div>
              
              {/* スムーズに増減するHPバー */}
              <div className="w-full h-3 border border-slate-950 bg-slate-950 rounded-full overflow-hidden shadow-inner p-[1px]">
                <div
                  style={{ width: `${hpRatio}%` }}
                  className={`h-full rounded-full transition-all duration-150 ${hpColorClass}`}
                />
              </div>
            </div>
          </div>

          {/* ビッグニュース！ たおした！ */}
          {defeated && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/30 backdrop-blur-[1px] rounded-3xl pointer-events-none z-30 animate-fade">
              <div className="p-4 bg-yellow-400 text-slate-950 px-8 py-3 rounded-2xl border-4 border-white font-display text-4xl shadow-2xl tracking-widest leading-none rotate-3 animate-ping">
                たおした！
              </div>
            </div>
          )}

          {/* クイック連打コンボカウンター表示 */}
          {combo > 1 && (
            <div className="absolute -bottom-1 z-30 pointer-events-none">
              <div className="bg-yellow-400 text-slate-950 text-xs px-3 py-1 rounded-full font-black tracking-wide shadow-lg border border-white animate-bounce flex items-center gap-1">
                🔥 {combo} れんぞく こうげき！{(combo >= 5) && <span className="text-red-600 font-extrabold">(こうげき力UP!)</span>}
              </div>
            </div>
          )}
        </div>

        {/* ==========================================
            🛒 お店（パワーアップ）セクション (下部固定)
            ========================================== */}
        <div className="z-10 bg-slate-950/80 backdrop-blur-md rounded-2xl p-2.5 border border-indigo-500/20 shadow-xl">
          <div className="flex justify-between items-center mb-1.5 px-1.5">
            <h3 className="text-xs font-display tracking-wider text-indigo-300 flex items-center gap-1">
              <Sparkles size={11} className="text-yellow-400" /> パワーアップおみせ 🛒
            </h3>
            <span className="text-[10px] text-slate-400">
              ゴールド(おかね)をつかって つよくしよう！
            </span>
          </div>

          <div className="flex flex-col gap-1.5 max-h-[125px] overflow-y-auto pr-1 scrollbar-thin">
            
            {/* アイテム1: ぶきをつよくする */}
            <div className="flex items-center justify-between bg-slate-900/90 hover:bg-slate-800/60 p-1.5 rounded-xl border border-indigo-500/10 transition-colors">
              <div className="flex items-center gap-2 max-w-[210px]">
                <div className="text-2xl w-9 h-9 rounded-lg bg-indigo-950/50 flex items-center justify-center border border-indigo-400/20">
                  ⚔️
                </div>
                <div className="text-left leading-tight">
                  <div className="text-xs font-bold text-white truncate">
                    {wepData.name} <span className="text-[10px] text-yellow-400 font-mono">Lv.{weaponLevel}</span>
                  </div>
                  <div className="text-[9px] text-slate-400">
                    こうげき：{wepData.dmg} → <span className="text-yellow-300 font-bold">つぎ: {wepData.nextDmg}</span>
                  </div>
                </div>
              </div>

              <button
                id="btn-upgrade-weapon"
                onClick={upgradeWeapon}
                disabled={gold < wepData.cost || defeated}
                className={`py-1.5 px-3 rounded-lg font-bold text-xs min-w-[70px] text-center transition-all ${
                  gold >= wepData.cost && !defeated
                    ? "bg-amber-400 text-slate-950 font-black border-r-[2px] border-b-[2px] border-amber-600 active:border-0 hover:bg-yellow-300"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                <span className="block text-[8px] opacity-75">ゴールド</span>
                <span className="block text-[11px] font-mono leading-none mt-0.5">🪙 {wepData.cost}</span>
              </button>
            </div>

            {/* アイテム2: まほうのつえを かう */}
            <div className="flex items-center justify-between bg-slate-900/90 hover:bg-slate-800/60 p-1.5 rounded-xl border border-indigo-500/10 transition-colors">
              <div className="flex items-center gap-2 max-w-[210px]">
                <div className="text-2xl w-9 h-9 rounded-lg bg-indigo-950/50 flex items-center justify-center border border-indigo-400/20">
                  🪄
                </div>
                <div className="text-left leading-tight">
                  <div className="text-xs font-bold text-white truncate">
                    {wandData.name} <span className="text-[10px] text-yellow-400 font-mono">Lv.{wandLevel}</span>
                  </div>
                  <div className="text-[9px] text-slate-400">
                    こうげき：+{wandData.dmg} → <span className="text-yellow-300 font-bold">つぎ: +{wandData.nextDmg}</span>
                  </div>
                </div>
              </div>

              <button
                id="btn-upgrade-wand"
                onClick={upgradeWand}
                disabled={gold < wandData.cost || defeated}
                className={`py-1.5 px-3 rounded-lg font-bold text-xs min-w-[70px] text-center transition-all ${
                  gold >= wandData.cost && !defeated
                    ? "bg-amber-400 text-slate-950 font-black border-r-[2px] border-b-[2px] border-amber-600 active:border-0 hover:bg-yellow-300"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                <span className="block text-[8px] opacity-75">ゴールド</span>
                <span className="block text-[11px] font-mono leading-none mt-0.5">🪙 {wandData.cost}</span>
              </button>
            </div>

            {/* アイテム3: まほうつかいのなかまを ふやす */}
            <div className="flex items-center justify-between bg-slate-900/90 hover:bg-slate-800/60 p-1.5 rounded-xl border border-indigo-500/10 transition-colors">
              <div className="flex items-center gap-2 max-w-[210px]">
                <div className="text-2xl w-9 h-9 rounded-lg bg-indigo-950/50 flex items-center justify-center border border-indigo-400/20">
                  🧙‍♂️
                </div>
                <div className="text-left leading-tight">
                  <div className="text-xs font-bold text-white truncate">
                    {compData.name} <span className="text-[10px] text-yellow-400 font-mono">Lv.{companionLevel}</span>
                  </div>
                  <div className="text-[9px] text-slate-400">
                    じどう：{compData.dps}秒 → <span className="text-yellow-300 font-bold">つぎ: {compData.nextDps}秒</span>
                  </div>
                </div>
              </div>

              <button
                id="btn-upgrade-companion"
                onClick={upgradeCompanion}
                disabled={gold < compData.cost || defeated}
                className={`py-1.5 px-3 rounded-lg font-bold text-xs min-w-[70px] text-center transition-all ${
                  gold >= compData.cost && !defeated
                    ? "bg-amber-400 text-slate-950 font-black border-r-[2px] border-b-[2px] border-amber-600 active:border-0 hover:bg-yellow-300"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                <span className="block text-[8px] opacity-75">ゴールド</span>
                <span className="block text-[11px] font-mono leading-none mt-0.5">🪙 {compData.cost}</span>
              </button>
            </div>

          </div>
        </div>

        {/* ==========================================
            📢 もしもの時のポップアップウインドウ（セーブ確認・お祝い）
            ========================================== */}
        
        {/* モーダル背景シャドー */}
        {(showResetConfirm || showVictoryGate || showInfo) && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" />
        )}

        {/* 1. 最初からやりなおす確認ポップアップ */}
        {showResetConfirm && (
          <div id="modal-reset" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-xs bg-slate-900 border-4 border-rose-500 rounded-3xl p-5 text-center shadow-2xl z-50 animate-bounce">
            <span className="text-4xl block mb-2">⚠️</span>
            <h3 className="text-base font-black text-rose-400 mb-2">
              データを けしちゃうよ？
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-5 font-bold">
              あつめたゴールドや ぶき、すてーじが ぜんぶ きえて、さいしょから に なっちゃうけれど、本当にやりなおす？
            </p>
            
            <div className="flex flex-col gap-2">
              <button
                id="btn-reset-confirm"
                onClick={resetGameData}
                className="w-full py-2 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-500 active:translate-y-0.5"
              >
                はい、さいしょから やりなおす
              </button>
              <button
                id="btn-reset-cancel"
                onClick={() => setShowResetConfirm(false)}
                className="w-full py-2 bg-slate-800 text-slate-400 rounded-xl font-bold text-xs hover:bg-slate-700 active:translate-y-0.5"
              >
                いいえ、ぼうけんを つづける
              </button>
            </div>
          </div>
        )}

        {/* 2. まおう撃破！大勝利おめでとうポップアップ */}
        {showVictoryGate && (
          <div id="modal-victory" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-gradient-to-b from-amber-500 via-indigo-900 to-indigo-950 border-4 border-yellow-300 rounded-3xl p-5 text-center shadow-2xl z-50">
            <span className="text-5xl block mb-1 animate-bounce">👑🏆🎉</span>
            
            <h2 className="text-lg font-display text-yellow-300 tracking-widest mt-1 mb-2 leading-none uppercase animate-pulse">
              まおうを やっつけた！
            </h2>
            
            <p className="text-xs text-yellow-100 font-bold leading-relaxed mb-4">
              こうきナイト、おめでとう！<br />
              おそろしいドラゴンまおうを たおして、せかいに へいわを とりもどしたぞ！
            </p>

            <div className="bg-slate-950/70 rounded-2xl p-3 border border-yellow-500/30 text-left mb-5">
              <p className="text-[10px] text-yellow-400 font-black text-center mb-1">
                🏆 こーきナイトの えいこうレコード
              </p>
              <div className="text-xs flex flex-col gap-1 text-slate-200">
                <div className="flex justify-between">
                  <span>・いままでの こうげき力：</span>
                  <span className="font-mono text-yellow-300 font-bold">{tapDamage} だめーじ</span>
                </div>
                <div className="flex justify-between">
                  <span>・なかまの じどう力：</span>
                  <span className="font-mono text-purple-300 font-bold">1秒に {dps} だめーじ</span>
                </div>
                <div className="flex justify-between">
                  <span>・あつめた最高コイン：</span>
                  <span className="font-mono text-yellow-300 font-bold">🪙 {gold} ごーるど</span>
                </div>
              </div>
            </div>

            <button
              id="btn-victory-continue"
              onClick={() => {
                setShowVictoryGate(false);
                sfx.playHit();
              }}
              className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 font-black rounded-xl text-xs hover:from-yellow-300 hover:to-amber-400 border-b-4 border-amber-600 active:border-0 hover:scale-105 transition-all"
            >
              さらにつよい まおう（うらステージ）にいどむ！🔥
            </button>
          </div>
        )}

        {/* 3. あそびかた説明ポップアップ */}
        {showInfo && (
          <div id="modal-info" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-xs bg-slate-900 border-4 border-indigo-400 rounded-3xl p-5 text-center shadow-2xl z-50">
            <span className="text-4xl block mb-2">⚔️</span>
            <h3 className="text-base font-black text-indigo-300 mb-1">
              あそびかた の せつめい
            </h3>
            
            <div className="text-xs text-left text-slate-300 leading-relaxed space-y-2 py-2 mb-4 max-h-48 overflow-y-auto pr-1">
              <p className="font-bold text-yellow-300">
                ① モンスターをこうげきしよう！
              </p>
              <p>
                がめん中央のモンスター、または「おっきなこうげきボタン」をタップすると、てきにだめーじを あたえられるよ！
              </p>

              <p className="font-bold text-yellow-300">
                ② コインをためてパワーアップ！
              </p>
              <p>
                てきをたおすと コイン（おかね）が手にはいるよ。おみせで「ぶき」や「まほうのつえ」をかって つよくしよう！
              </p>

              <p className="font-bold text-yellow-300">
                ③ なかまをふやす！
              </p>
              <p>
                「なかま」をかうと、タップしなくても 1びょうごとに自動で てきにだめーじを あたえてくれるよ！
              </p>

              <p className="font-bold text-yellow-300">
                ④ れんぞくタップでコンボ！
              </p>
              <p>
                すばやくタップすると「れんぞくこうげき」コンボがたまるよ！コンボがたまると こうげきりょくがアップ！
              </p>
            </div>

            <button
              id="btn-info-close"
              onClick={() => {
                setShowInfo(false);
                sfx.playHit();
              }}
              className="w-full py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-slate-700 active:translate-y-0.5"
            >
              わかった！あそぶ！
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
