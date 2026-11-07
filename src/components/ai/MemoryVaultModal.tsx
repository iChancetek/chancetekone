'use client';

import React, { useState } from 'react';
import {
  Brain,
  X,
  Plus,
  Trash2,
  Sparkles,
  Zap,
  RotateCcw,
  Sliders,
  Check,
  Music2,
  HardDrive,
  Info,
  Clock,
} from 'lucide-react';
import { LongTermMemory, ShortTermMemory, MemoryFact, TasteProfile } from '@/types/memory';
import { MemoryManager } from '@/lib/agents/memory';

interface MemoryVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  longTermMemory: LongTermMemory;
  shortTermMemory: ShortTermMemory;
  onMemoryUpdated: (updatedLtm: LongTermMemory, updatedStm: ShortTermMemory) => void;
}

export const MemoryVaultModal: React.FC<MemoryVaultModalProps> = ({
  isOpen,
  onClose,
  longTermMemory,
  shortTermMemory,
  onMemoryUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'ltm' | 'stm' | 'dna'>('ltm');
  const [newFactInput, setNewFactInput] = useState('');
  const [newFactCategory, setNewFactCategory] = useState<MemoryFact['category']>('preference');
  const [isAddingFact, setIsAddingFact] = useState(false);

  if (!isOpen) return null;

  const handleAddFact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFactInput.trim()) return;

    MemoryManager.addExplicitFact(newFactInput.trim(), newFactCategory, longTermMemory.userId, 'user_stated');
    const updatedLtm = MemoryManager.getLongTermMemory(longTermMemory.userId);
    onMemoryUpdated(updatedLtm, shortTermMemory);
    setNewFactInput('');
    setIsAddingFact(false);
  };

  const handleDeleteFact = (factId: string) => {
    MemoryManager.removeFact(factId, longTermMemory.userId);
    const updatedLtm = MemoryManager.getLongTermMemory(longTermMemory.userId);
    onMemoryUpdated(updatedLtm, shortTermMemory);
  };

  const handleClearSession = () => {
    const clearedStm = MemoryManager.clearShortTermMemory();
    onMemoryUpdated(longTermMemory, clearedStm);
  };

  const handleResetLTM = () => {
    if (confirm('Reset your ChanceTEK One AI Long-Term Memory and taste DNA back to defaults?')) {
      const resetLtm = MemoryManager.resetLongTermMemory(longTermMemory.userId, longTermMemory.userName);
      onMemoryUpdated(resetLtm, shortTermMemory);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#0c0c16]/95 border border-brand-purple/40 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/10 bg-gradient-to-r from-brand-purple/30 via-[#101020] to-brand-gold/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-purple to-brand-gold flex items-center justify-center border border-brand-gold/40 shadow-lg">
              <Brain className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                AI Memory Vault & Neural Profile
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-neon/20 text-brand-neon font-mono font-bold">
                  Active
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Short-term session context & long-term musical DNA curation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 px-5 pt-3 gap-2 bg-[#08080f]/60">
          <button
            onClick={() => setActiveTab('ltm')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'ltm'
                ? 'border-brand-gold text-brand-gold'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Remembered Facts ({longTermMemory.explicitFacts.length})
          </button>

          <button
            onClick={() => setActiveTab('dna')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'dna'
                ? 'border-brand-purple text-brand-neon'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Musical DNA & Taste
          </button>

          <button
            onClick={() => setActiveTab('stm')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'stm'
                ? 'border-brand-amber text-brand-amber'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Session Working Memory
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: REMEMBERED FACTS */}
          {activeTab === 'ltm' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-300">
                  Explicit memories and habits ChanceTEK One AI draws upon to personalize recommendations.
                </p>
                <button
                  onClick={() => setIsAddingFact(!isAddingFact)}
                  className="px-3 py-1.5 rounded-xl bg-brand-purple hover:bg-brand-violet text-white text-xs font-semibold flex items-center gap-1 shadow-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Memory
                </button>
              </div>

              {/* Add Fact Form */}
              {isAddingFact && (
                <form onSubmit={handleAddFact} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-3 animate-in fade-in">
                  <input
                    type="text"
                    value={newFactInput}
                    onChange={(e) => setNewFactInput(e.target.value)}
                    placeholder="e.g. Produces breaks on an Akai MPC60; Loves 95 BPM boom bap..."
                    className="w-full py-2 px-3 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-purple"
                    autoFocus
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {(['preference', 'equipment', 'bio', 'general'] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setNewFactCategory(cat)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] uppercase font-bold transition-all ${
                            newFactCategory === cat
                              ? 'bg-brand-gold text-black'
                              : 'bg-white/10 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingFact(false)}
                        className="px-3 py-1 rounded-lg text-xs text-neutral-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 rounded-lg bg-brand-gold text-black text-xs font-bold shadow-md hover:scale-105 transition-transform"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Facts List */}
              <div className="space-y-2">
                {longTermMemory.explicitFacts.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/15 transition-all group"
                  >
                    <div className="space-y-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-md bg-brand-purple/30 text-brand-neon font-bold">
                          {item.category}
                        </span>
                        <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-100 font-medium leading-relaxed">
                        {item.fact}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteFact(item.id)}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete this memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: MUSICAL DNA */}
          {activeTab === 'dna' && (
            <div className="space-y-5">
              {/* Preferred Genres */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-brand-gold uppercase tracking-wider flex items-center gap-1.5">
                  <Music2 className="w-3.5 h-3.5" /> Favorite Genres & Styles
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {longTermMemory.tasteProfile.favoriteGenres.map((g, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full bg-brand-purple/20 border border-brand-purple/40 text-xs text-white font-medium shadow-sm"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>

              {/* BPM Pocket */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-brand-neon" /> BPM Pocket (Tempo Sweet Spot)
                  </h4>
                  <span className="text-xs font-mono font-bold text-brand-neon">
                    {longTermMemory.tasteProfile.bpmSweetSpot.min} - {longTermMemory.tasteProfile.bpmSweetSpot.max} BPM (Target: {longTermMemory.tasteProfile.bpmSweetSpot.preferred} BPM)
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full relative overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 bg-gradient-to-r from-brand-purple via-brand-neon to-brand-gold rounded-full"
                    style={{
                      left: `${((longTermMemory.tasteProfile.bpmSweetSpot.min - 60) / 140) * 100}%`,
                      width: `${((longTermMemory.tasteProfile.bpmSweetSpot.max - longTermMemory.tasteProfile.bpmSweetSpot.min) / 140) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Hardware & Gear Interests */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-brand-neon uppercase tracking-wider flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5" /> Hardware & Sampler Interests
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {longTermMemory.tasteProfile.gearInterests.map((gear, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs text-neutral-300 font-mono"
                    >
                      {gear}
                    </span>
                  ))}
                </div>
              </div>

              {/* Vibe & Aesthetic Tags */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-brand-amber uppercase tracking-wider">
                  Vibe & Texture Affinities
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {longTermMemory.tasteProfile.vibeTags.map((vibe, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-full bg-brand-gold/10 border border-brand-gold/30 text-xs text-brand-gold font-medium"
                    >
                      ✨ {vibe}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SESSION WORKING MEMORY */}
          {activeTab === 'stm' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-brand-gold" /> Active Session State
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400">
                    ID: {shortTermMemory.sessionId}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <p className="text-[10px] text-neutral-400">Active Playing Track</p>
                    <p className="font-semibold text-white truncate">
                      {shortTermMemory.activeTrackTitle || 'No active track'}
                    </p>
                    {shortTermMemory.activeBpm && (
                      <p className="text-[10px] text-brand-neon font-mono">
                        {shortTermMemory.activeBpm} BPM · {shortTermMemory.activeGenre}
                      </p>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <p className="text-[10px] text-neutral-400">Current Route</p>
                    <p className="font-semibold text-white truncate">
                      {shortTermMemory.activePath || '/'}
                    </p>
                  </div>
                </div>

                {/* Session Working Notes */}
                {shortTermMemory.sessionWorkingNotes && shortTermMemory.sessionWorkingNotes.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Working Scratchpad</p>
                    <div className="space-y-1">
                      {shortTermMemory.sessionWorkingNotes.map((note, i) => (
                        <p key={i} className="text-xs text-neutral-300 p-2 rounded-lg bg-white/5 font-mono">
                          • {note}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleClearSession}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-neutral-300 flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear Session Context
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#08080f]/80 flex items-center justify-between">
          <button
            onClick={handleResetLTM}
            className="text-xs text-neutral-500 hover:text-red-400 flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset AI Memory to Defaults
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-brand-gold text-black text-xs font-bold shadow-md hover:scale-105 transition-transform"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
