'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Volume2,
  VolumeX,
  RotateCcw,
  Zap,
  Flame,
  Radio,
  Brain,
  GripHorizontal,
  Minus,
  ChevronUp,
} from 'lucide-react';
import { AIMessage, AgentContextPayload } from '@/types/agent';
import { LongTermMemory, ShortTermMemory } from '@/types/memory';
import { AIMessageCard } from './AIMessageCard';
import { VoiceRecorder } from './VoiceRecorder';
import { MemoryVaultModal } from './MemoryVaultModal';
import { MemoryManager } from '@/lib/agents/memory';
import { usePlayer } from '@/lib/player/PlayerContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAI } from '@/lib/ai/AIContext';

const INITIAL_SUGGESTIONS = [
  'What can I explore on ChanceTEK One?',
  'Play the freshest 90s breakbeat track',
  'Tell me the history of the Amen break',
  'How do I install this app for offline playback?',
  'Recommend vinyl releases based on my taste',
];

export const BreakBeatsAssistant: React.FC<{ isOpen?: boolean; onClose?: () => void }> = ({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
}) => {
  const pathname = usePathname();
  const { currentTrack } = usePlayer();
  const { profile } = useAuth();
  const {
    initialPrompt,
    clearInitialPrompt,
    openAI,
    closeAI,
    isFloatingCollapsed,
    collapseFloatingAI,
  } = useAI();

  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const handleOpen = () => {
    openAI();
    setInternalIsOpen(true);
  };

  const handleClose = () => {
    collapseFloatingAI();
    if (controlledOnClose) {
      controlledOnClose();
    } else {
      closeAI();
      setInternalIsOpen(false);
    }
  };

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [isMemoryVaultOpen, setIsMemoryVaultOpen] = useState(false);

  // Floating Position & Dragging States
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [triggerPos, setTriggerPos] = useState<{ x: number; y: number } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [isDraggingTrigger, setIsDraggingTrigger] = useState(false);

  const panelDragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const triggerDragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number; hasMoved: boolean } | null>(null);

  // Hydrate positions from localStorage on client mount
  useEffect(() => {
    const panelWidth = Math.min(window.innerWidth * 0.95, 420);
    const panelHeight = 580;
    const savedPanel = typeof window !== 'undefined' ? localStorage.getItem('break_beats_ai_panel_pos') : null;

    if (savedPanel) {
      try {
        const parsed = JSON.parse(savedPanel);
        setPanelPos({
          x: Math.max(10, Math.min(window.innerWidth - panelWidth - 10, parsed.x)),
          y: Math.max(10, Math.min(window.innerHeight - panelHeight - 10, parsed.y)),
        });
      } catch {
        setPanelPos({
          x: Math.max(10, window.innerWidth - panelWidth - 24),
          y: Math.max(10, window.innerHeight - panelHeight - 96),
        });
      }
    } else {
      setPanelPos({
        x: Math.max(10, window.innerWidth - panelWidth - 24),
        y: Math.max(10, window.innerHeight - panelHeight - 96),
      });
    }

    const triggerWidth = 160;
    const triggerHeight = 50;
    const savedTrigger = typeof window !== 'undefined' ? localStorage.getItem('break_beats_ai_trigger_pos') : null;

    if (savedTrigger) {
      try {
        const parsed = JSON.parse(savedTrigger);
        setTriggerPos({
          x: Math.max(10, Math.min(window.innerWidth - triggerWidth - 10, parsed.x)),
          y: Math.max(10, Math.min(window.innerHeight - triggerHeight - 80, parsed.y)),
        });
      } catch {
        setTriggerPos({
          x: Math.max(10, window.innerWidth - triggerWidth - 24),
          y: Math.max(10, window.innerHeight - triggerHeight - 100),
        });
      }
    } else {
      setTriggerPos({
        x: Math.max(10, window.innerWidth - triggerWidth - 24),
        y: Math.max(10, window.innerHeight - triggerHeight - 100),
      });
    }
  }, []);

  // Handle window resizing to keep panel and trigger on-screen
  useEffect(() => {
    const handleResize = () => {
      setPanelPos((prev) => {
        if (!prev) return prev;
        const panelWidth = Math.min(window.innerWidth * 0.95, 420);
        const panelHeight = isMinimized ? 56 : 580;
        return {
          x: Math.max(10, Math.min(window.innerWidth - panelWidth - 10, prev.x)),
          y: Math.max(10, Math.min(window.innerHeight - panelHeight - 10, prev.y)),
        };
      });

      setTriggerPos((prev) => {
        if (!prev) return prev;
        const triggerWidth = 160;
        const triggerHeight = 50;
        return {
          x: Math.max(10, Math.min(window.innerWidth - triggerWidth - 10, prev.x)),
          y: Math.max(10, Math.min(window.innerHeight - triggerHeight - 80, prev.y)),
        };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMinimized]);

  // Pointer drag event handlers for the Assistant Panel
  const handlePanelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a')) return;
    if (!panelPos) return;

    panelDragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: panelPos.x,
      initialY: panelPos.y,
    };
    setIsDraggingPanel(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePanelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingPanel || !panelDragStartRef.current) return;
    const deltaX = e.clientX - panelDragStartRef.current.startX;
    const deltaY = e.clientY - panelDragStartRef.current.startY;

    const panelWidth = Math.min(window.innerWidth * 0.95, 420);
    const panelHeight = isMinimized ? 56 : 580;

    const newX = Math.max(10, Math.min(window.innerWidth - panelWidth - 10, panelDragStartRef.current.initialX + deltaX));
    const newY = Math.max(10, Math.min(window.innerHeight - panelHeight - 10, panelDragStartRef.current.initialY + deltaY));

    setPanelPos({ x: newX, y: newY });
  };

  const handlePanelPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingPanel) {
      setIsDraggingPanel(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      panelDragStartRef.current = null;
      if (panelPos) {
        localStorage.setItem('break_beats_ai_panel_pos', JSON.stringify(panelPos));
      }
    }
  };

  // Pointer drag event handlers for the Floating Trigger Button
  const handleTriggerPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    if (!triggerPos) return;

    triggerDragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: triggerPos.x,
      initialY: triggerPos.y,
      hasMoved: false,
    };
    setIsDraggingTrigger(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleTriggerPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDraggingTrigger || !triggerDragStartRef.current) return;
    const deltaX = e.clientX - triggerDragStartRef.current.startX;
    const deltaY = e.clientY - triggerDragStartRef.current.startY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      triggerDragStartRef.current.hasMoved = true;
    }

    const triggerWidth = 160;
    const triggerHeight = 50;

    const newX = Math.max(10, Math.min(window.innerWidth - triggerWidth - 10, triggerDragStartRef.current.initialX + deltaX));
    const newY = Math.max(10, Math.min(window.innerHeight - triggerHeight - 80, triggerDragStartRef.current.initialY + deltaY));

    setTriggerPos({ x: newX, y: newY });
  };

  const handleTriggerPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (isDraggingTrigger) {
      const moved = triggerDragStartRef.current?.hasMoved;
      setIsDraggingTrigger(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      triggerDragStartRef.current = null;

      if (triggerPos) {
        localStorage.setItem('break_beats_ai_trigger_pos', JSON.stringify(triggerPos));
      }

      if (!moved) {
        handleOpen();
      }
    }
  };

  // Toggle Collapse / Minimize
  const toggleMinimize = () => {
    setIsMinimized((prev) => {
      const next = !prev;
      if (!next && panelPos) {
        const panelHeight = 580;
        if (panelPos.y + panelHeight > window.innerHeight - 10) {
          setPanelPos({
            x: panelPos.x,
            y: Math.max(10, window.innerHeight - panelHeight - 10),
          });
        }
      }
      return next;
    });
  };

  // Short-Term and Long-Term Memory States
  const [longTermMemory, setLongTermMemory] = useState<LongTermMemory>(() =>
    MemoryManager.getLongTermMemory(profile?.id || 'default-user', profile?.name)
  );
  const [shortTermMemory, setShortTermMemory] = useState<ShortTermMemory>(() =>
    MemoryManager.getShortTermMemory()
  );

  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Yo! I am **ChanceTEK One AI** — your Agentic AI crate digger and culture assistant powered by **Agentic Intelligence** with **Dual Memory**. Ask me to find tracks, build custom playlists, remember your studio gear, or explore exclusive vinyl.',
      timestamp: new Date().toISOString(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Sync profile changes into LTM
  useEffect(() => {
    if (profile?.id) {
      const ltm = MemoryManager.getLongTermMemory(profile.id, profile.name);
      setLongTermMemory(ltm);
      MemoryManager.hydrateFromFirestore(profile.id).then((hydrated) => {
        if (hydrated) setLongTermMemory(hydrated);
      });
    }
  }, [profile?.id, profile?.name]);

  // Sync real-time playback context into Short-Term Memory
  useEffect(() => {
    const updatedStm = MemoryManager.updateShortTermContext({
      activePath: pathname,
      activeTrackId: currentTrack?.id,
      activeTrackTitle: currentTrack?.title,
      activeArtistName: currentTrack?.artistName,
      activeBpm: currentTrack?.bpm,
      activeGenre: currentTrack?.genre,
    });
    setShortTermMemory(updatedStm);
  }, [pathname, currentTrack]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-send initial prompt if triggered from external Ask AI buttons
  useEffect(() => {
    if (initialPrompt && isOpen) {
      sendMessage(initialPrompt);
      clearInitialPrompt();
    }
  }, [initialPrompt, isOpen]);

  const sendMessage = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    // 1. Check & extract instant heuristic insights into LTM
    const { newFact, tasteUpdate } = MemoryManager.extractMemoryInsights(text, profile?.id || 'default-user');
    if (newFact || tasteUpdate) {
      const updatedLtm = MemoryManager.getLongTermMemory(profile?.id || 'default-user');
      setLongTermMemory(updatedLtm);
    }

    // 2. Record query in STM
    const updatedStm = MemoryManager.addRecentQuery(text.trim());
    setShortTermMemory(updatedStm);

    const userMsg: AIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const currentLtm = MemoryManager.getLongTermMemory(profile?.id || 'default-user');

    const contextPayload: AgentContextPayload = {
      currentPath: pathname,
      currentTrackId: currentTrack?.id,
      currentTrackTitle: currentTrack?.title,
      currentArtistName: currentTrack?.artistName,
      currentBpm: currentTrack?.bpm,
      currentGenre: currentTrack?.genre,
      userName: profile?.name,
      userId: profile?.id || 'default-user',
      language: language,
      shortTermMemory: updatedStm,
      longTermMemory: currentLtm,
    };

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          messages: [...messages, userMsg],
          context: contextPayload,
        }),
      });

      const data = await res.json();

      // If server returned memory updates from tool execution, apply them
      if (data.memoryUpdates) {
        if (data.memoryUpdates.newFacts) {
          data.memoryUpdates.newFacts.forEach((f: any) => {
            MemoryManager.addExplicitFact(f.fact, f.category, profile?.id || 'default-user');
          });
        }
        if (data.memoryUpdates.updatedTaste) {
          MemoryManager.updateTasteProfile(data.memoryUpdates.updatedTaste, profile?.id || 'default-user');
        }
        setLongTermMemory(MemoryManager.getLongTermMemory(profile?.id || 'default-user'));
      }

      const assistantMsg: AIMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.content || 'Here is what I found for you!',
        timestamp: new Date().toISOString(),
        toolCalls: data.toolCalls,
        mediaRecommendations: data.recommendations,
        memoryUpdates: data.memoryUpdates,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If TTS enabled, synthesize voice response with Nova calm voice and active language
      if (ttsEnabled && data.content) {
        speakResponse(data.content, language);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: err?.message && err.message !== 'Failed to fetch'
            ? `⚠️ ${err.message}`
            : 'ChanceTEK One AI encountered a temporary connection delay. Please tap send again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const speakResponse = async (text: string, lang: 'en' | 'es' = language) => {
    // 1. Try server OpenAI TTS
    try {
      const res = await fetch('/api/ai/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ text, voice: 'nova', language: lang }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
        return;
      }
    } catch (err) {
      console.warn('TTS playback server error, falling back to browser synthesis:', err);
    }

    // 2. Fallback to HTML5 SpeechSynthesis (offline, free, no credits required)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const cleanText = text.replace(/[*#_`>]/g, '').slice(0, 300);
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = lang === 'es' ? 'es-ES' : 'en-US';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (speechErr) {
        console.warn('Browser speech synthesis error:', speechErr);
      }
    }
  };

  return (
    <>
      {/* Floating Trigger Button (Draggable & Collapsible from screen, closed by default) */}
      {!isOpen && !isFloatingCollapsed && (
        <div
          style={
            triggerPos
              ? {
                  position: 'fixed',
                  left: `${triggerPos.x}px`,
                  top: `${triggerPos.y}px`,
                  zIndex: 40,
                }
              : undefined
          }
          className={`fixed ${
            triggerPos ? '' : 'bottom-24 md:bottom-28 right-4 md:right-8'
          } z-40 flex items-center shadow-2xl rounded-full bg-gradient-to-r from-brand-purple to-brand-violet text-white border border-brand-neon/50 transition-transform group animate-glow select-none touch-none ${
            isDraggingTrigger ? 'scale-105 shadow-[0_0_25px_rgba(168,85,247,0.8)]' : 'hover:scale-105'
          }`}
        >
          <button
            onPointerDown={handleTriggerPointerDown}
            onPointerMove={handleTriggerPointerMove}
            onPointerUp={handleTriggerPointerUp}
            onClick={() => {
              if (triggerDragStartRef.current?.hasMoved) return;
              handleOpen();
            }}
            className="p-3.5 pr-2 flex items-center gap-2 cursor-grab active:cursor-grabbing"
            title="Press & drag to move ChanceTEK One AI anywhere on screen, or tap to open"
          >
            <GripHorizontal className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
            <Sparkles className="w-5 h-5 text-brand-gold animate-spin-slow" />
            <span className="hidden sm:inline text-xs font-bold tracking-wide">ChanceTEK One AI</span>
            <span className="w-2 h-2 rounded-full bg-brand-neon animate-ping" />
          </button>

          {/* Dedicated Collapse Button to remove following widget from screen */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              collapseFloatingAI();
            }}
            className="p-2 mr-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
            title="Collapse ChanceTEK One AI from screen"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Assistant Modal / Panel (Draggable & Collapsible) */}
      {isOpen && (
        <div
          style={
            panelPos
              ? {
                  position: 'fixed',
                  left: `${panelPos.x}px`,
                  top: `${panelPos.y}px`,
                  zIndex: 50,
                  width: 'min(95vw, 420px)',
                  height: isMinimized ? 'auto' : '580px',
                  maxHeight: '92vh',
                }
              : undefined
          }
          className={`fixed ${
            panelPos ? '' : 'bottom-20 md:bottom-24 right-2 md:right-8 w-[95vw] sm:w-[420px] h-[580px]'
          } glass-panel rounded-3xl z-50 flex flex-col border border-brand-purple/40 shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden bg-[#0c0c16]/95 transition-[height] duration-200 animate-in fade-in`}
        >
          {/* Header & Drag Handle Bar */}
          <div
            onPointerDown={handlePanelPointerDown}
            onPointerMove={handlePanelPointerMove}
            onPointerUp={handlePanelPointerUp}
            className={`p-3.5 sm:p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-brand-purple/30 via-brand-dark/40 to-brand-purple/20 select-none touch-none cursor-grab active:cursor-grabbing transition-colors ${
              isDraggingPanel ? 'bg-brand-purple/50 border-brand-gold/40' : ''
            }`}
            title="Press and drag to move ChanceTEK One AI anywhere on platform"
          >
            <div className="flex items-center gap-2 min-w-0">
              {/* Drag indicator icon */}
              <div
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white shrink-0"
                title="Drag to reposition"
              >
                <GripHorizontal className="w-4 h-4" />
              </div>

              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-purple to-brand-gold flex items-center justify-center border border-brand-gold/50 shadow-md shrink-0">
                <Sparkles className="w-4 h-4 text-white animate-spin-slow" />
              </div>

              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5 truncate">
                  <span>ChanceTEK One AI</span>
                  {isMinimized && (
                    <span className="text-[10px] text-brand-gold font-normal px-1.5 py-0.5 rounded-full bg-brand-gold/15 border border-brand-gold/30">
                      Collapsed
                    </span>
                  )}
                </h3>
                {!isMinimized && (
                  <p className="text-[10px] text-neutral-400 truncate">
                    Agentic Dual-Memory · Drag to reposition
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {!isMinimized && (
                <>
                  {/* Language Selector (EN / ES) */}
                  <button
                    onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
                    className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                      language === 'es'
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                        : 'bg-white/10 border-white/15 text-neutral-300'
                    }`}
                    title={language === 'en' ? 'Switch to Spanish (Español)' : 'Switch to English'}
                  >
                    {language === 'en' ? 'EN' : 'ES'}
                  </button>

                  {/* Memory Vault Trigger Button */}
                  <button
                    onClick={() => setIsMemoryVaultOpen(true)}
                    className="p-1.5 px-2 rounded-full bg-brand-purple/30 border border-brand-purple/50 text-brand-neon hover:bg-brand-purple/50 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                    title="Open AI Memory Vault (Short-Term & Long-Term Memory)"
                  >
                    <Brain className="w-3.5 h-3.5 text-brand-neon" />
                    <span className="hidden xs:inline">Memory</span>
                    <span className="px-1 rounded-full bg-brand-neon/20 text-[9px]">
                      {longTermMemory.explicitFacts.length}
                    </span>
                  </button>

                  {/* Voice TTS Toggle */}
                  <button
                    onClick={() => setTtsEnabled(!ttsEnabled)}
                    className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                      ttsEnabled ? 'text-brand-gold bg-brand-gold/20' : 'text-neutral-400 hover:text-white'
                    }`}
                    title={ttsEnabled ? 'Voice Response Enabled (Nova Calm Voice)' : 'Enable Spoken Voice Response (Nova)'}
                  >
                    {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>

                  {/* Reset Conversation */}
                  <button
                    onClick={() => setMessages([messages[0]])}
                    className="p-1.5 rounded-full text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    title="Reset Conversation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              {/* Collapse / Make Smaller Toggle Button */}
              <button
                onClick={toggleMinimize}
                className="p-1.5 rounded-full text-neutral-300 hover:text-brand-gold hover:bg-white/10 transition-colors cursor-pointer"
                title={isMinimized ? 'Expand ChanceTEK One AI (Make larger)' : 'Collapse ChanceTEK One AI (Make smaller)'}
              >
                {isMinimized ? <ChevronUp className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
              </button>

              {/* Close Button */}
              <button
                onClick={handleClose}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Close Assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Feed, Suggestions & Input only visible when expanded */}
          {!isMinimized && (
            <>
              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <AIMessageCard key={msg.id} message={msg} />
                ))}

                {loading && (
                  <div className="flex items-center gap-2 text-xs text-brand-neon p-3 bg-white/5 rounded-2xl border border-white/5 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin text-brand-gold" />
                    <span>ChanceTEK One AI is consulting crate memory & reasoning...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggested Prompts Pill Row */}
              {messages.length <= 2 && (
                <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
                  {INITIAL_SUGGESTIONS.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(sug)}
                      className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-brand-purple/30 border border-white/10 text-[10px] text-neutral-300 hover:text-white whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Bar with Voice Button */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="p-3 border-t border-white/10 bg-[#08080c]/80 flex items-center gap-2"
              >
                <VoiceRecorder onTranscribed={(text) => sendMessage(text)} language={language} disabled={loading} />

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={language === 'es' ? 'Pregunta o comparte tus preferencias de sonido...' : 'Ask, queue tracks, or share gear/taste preferences...'}
                  className="flex-1 py-2 px-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-brand-purple transition-all"
                />

                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="p-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-gold text-white disabled:opacity-40 hover:scale-105 transition-all shadow-md"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Memory Vault Modal */}
      <MemoryVaultModal
        isOpen={isMemoryVaultOpen}
        onClose={() => setIsMemoryVaultOpen(false)}
        longTermMemory={longTermMemory}
        shortTermMemory={shortTermMemory}
        onMemoryUpdated={(updatedLtm, updatedStm) => {
          setLongTermMemory(updatedLtm);
          setShortTermMemory(updatedStm);
        }}
      />
    </>
  );
};
