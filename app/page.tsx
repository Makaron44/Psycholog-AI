'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import { 
  Brain, 
  RotateCcw, 
  ChevronRight, 
  History, 
  Sparkles, 
  AlertCircle,
  Loader2,
  BarChart3,
  FileJson,
  Settings,
  X,
  Moon,
  Sun,
  FileDown
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend,
} from 'recharts';
import { useTheme } from 'next-themes';

// --- Types ---
interface SummarySection {
  tytul: string;
  tresc: string;
}

interface SimulationTurn {
  opis_sytuacji: string;
  reakcja_1: string;
  reakcja_2: string;
  reakcja_3: string;
  styl_1: string;
  styl_2: string;
  styl_3: string;
  komentarz_eksperta?: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

type AppState = 'setup' | 'simulation' | 'summary';

// --- Constants ---
const CHECK_INTERVAL = 5;
const MAX_HISTORY_LENGTH = 10;

export default function BehaviorSimulator() {
  // --- State ---
  const [appState, setAppState] = useState<AppState>('setup');
  const [isMounted, setIsMounted] = useState(false);
  const [situationInput, setSituationInput] = useState('');
  const [name, setName] = useState('');
  const [profession, setProfession] = useState('');
  const [context, setContext] = useState('');
  const [turnCount, setTurnCount] = useState(0);
  const [currentTurn, setCurrentTurn] = useState<SimulationTurn | null>(null);
  const [summary, setSummary] = useState<SummarySection[] | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chosenStyles, setChosenStyles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini');
  const [showSettings, setShowSettings] = useState(false);
  
  const { theme, setTheme } = useTheme();
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const hasSeenOnboarding = localStorage.getItem('onboarding_seen');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
    const savedOpenAiKey = localStorage.getItem('openai_api_key');
    if (savedOpenAiKey) {
      setOpenaiApiKey(savedOpenAiKey);
    }
    const savedModel = localStorage.getItem('selected_model');
    if (savedModel) {
      setSelectedModel(savedModel);
    }
  }, []);

  // --- Helpers ---
  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const processTurn = async (userPrompt: string, isSummaryRequest: boolean = false) => {
    if (selectedModel === 'gemini' && !apiKey) {
      showError("Brak klucza API dla Gemini. Kliknij ikonę u góry po prawej (Ustawienia), aby go dodać.");
      setShowSettings(true);
      return;
    }
    if (selectedModel !== 'gemini' && !openaiApiKey) {
      showError("Brak klucza API dla OpenAI. Kliknij ikonę Ustawień.");
      setShowSettings(true);
      return;
    }

    setIsLoading(true);
    setLoadingText(isSummaryRequest ? "Generowanie profilu psychologicznego..." : "Analiza sytuacji i zachowań...");

    const newHistory: ChatMessage[] = [
      ...chatHistory,
      { role: "user", parts: [{ text: userPrompt }] }
    ];
    setChatHistory(newHistory);

    try {
      let systemInstruction = `Jesteś światowej klasy ekspertem w dziedzinie psychologii behawioralnej i klinicznej. 
      Twoim zadaniem jest prowadzenie realistycznej, wielowarstwowej symulacji sytuacji kryzysowej lub społecznej. 
      Zwracaj się do użytkownika bezpośrednio po imieniu: ${name || "użytkowniku"}.
      
      Każdy krok musi być logiczną kontynuacją poprzednich wyborów, uwzględniając zawód użytkownika (${profession || "nieokreślony"}) i wybrany kontekst (${context || "ogólny"}). 
      Twórz opisy sytuacji, które są bogate w detale psychologiczne (np. mowa ciała innych osób, Twoje wewnętrzne odczucia, presja czasu). 
      
      Jeśli to nie jest pierwsza tura (turnCount > 0), dodaj krótki, błyskotliwy komentarz ekspercki (komentarz_eksperta) dotyczący ostatniego wyboru użytkownika, wyjaśniający jego psychologiczne podłoże lub potencjalne konsekwencje. Długość dla komentarza max 1-2 zdania.

      Reakcje, które proponujesz, powinny reprezentować różne style radzenia sobie: 
      - Reakcja 1: Skupiona na zadaniu / logiczna.
      - Reakcja 2: Skupiona na relacjach / emocjonalna.
      - Reakcja 3: Skupiona na unikaniu / bezpieczeństwie lub nieszablonowa.
      
      Zwracasz wyłącznie JSON.`;

      if (isSummaryRequest) {
        systemInstruction = `Jesteś światowej klasy profesorem psychologii klinicznej i ekspertem analizy behawioralnej. 
        Twoim zadaniem jest stworzenie pogłębionego, wielowymiarowego profilu psychologicznego użytkownika na podstawie jego decyzji w symulacji. 
        
        Analiza musi być zróżnicowana i zawierać następujące sekcje:
        1. ARCHETYP REAKCJI: Zidentyfikuj dominujący wzorzec.
        2. STYL DECYZYJNY: Przeanalizuj, czy wybory są oparte na logice, emocjach, czy unikaniu ryzyka.
        3. WPŁYW ZAWODU: Jak profesja (${profession || "nieokreślona"}) wpłynęła na podejście do problemu (${context || "ogólnego"}).
        4. INTELIGENCJA EMOCJONALNA: Ocena zdolności.
        5. KOMENTARZ EKSPERCKI: Podsumowujący, głęboki wgląd od psychologa.
        6. POTENCJAŁ I RYZYKA: Wskaż mocne strony oraz 'martwe punkty'.
        
        Używaj profesjonalnego, eseistycznego stylu. Odwołuj się do konkretnych wyborów dokonanych przez użytkownika. 
        Zwróć JSON z kluczem 'sekcje', który jest tablicą obiektów z kluczami 'tytul' i 'tresc'.`;
      }

      let text = "";

      if (selectedModel.startsWith('gpt')) {
        const openai = new OpenAI({ apiKey: openaiApiKey, dangerouslyAllowBrowser: true });
        
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
        messages.push({ role: "system", content: systemInstruction });
        for (const msg of newHistory) {
          messages.push({ 
            role: msg.role === 'model' ? "assistant" : "user", 
            content: msg.parts[0].text 
          });
        }

        const responseSchemaOpenAI = isSummaryRequest ? {
          name: "summary_response",
          schema: {
            type: "object",
            properties: {
              sekcje: {
                type: "array",
                items: {
                  type: "object",
                  properties: { tytul: { type: "string" }, tresc: { type: "string" } },
                  required: ["tytul", "tresc"],
                  additionalProperties: false
                }
              }
            },
            required: ["sekcje"],
            additionalProperties: false
          },
          strict: true
        } : {
          name: "simulation_turn",
          schema: {
            type: "object",
            properties: {
              opis_sytuacji: { type: "string" },
              reakcja_1: { type: "string" },
              reakcja_2: { type: "string" },
              reakcja_3: { type: "string" },
              styl_1: { type: "string" },
              styl_2: { type: "string" },
              styl_3: { type: "string" },
              komentarz_eksperta: { type: "string" }
            },
            required: ["opis_sytuacji", "reakcja_1", "reakcja_2", "reakcja_3", "styl_1", "styl_2", "styl_3", "komentarz_eksperta"],
            additionalProperties: false
          },
          strict: true
        };

        const response = await openai.chat.completions.create({
          model: selectedModel,
          messages: messages,
          // @ts-ignore dynamic json_schema binding
          response_format: { type: "json_schema", json_schema: responseSchemaOpenAI }
        });

        text = response.choices[0]?.message?.content || "";

      } else {
        const genAI = new GoogleGenAI({ apiKey });
        const model = "gemini-2.5-flash-lite";

        let responseSchemaGemini: any = isSummaryRequest 
          ? {
            type: Type.OBJECT,
            properties: {
              sekcje: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    tytul: { type: Type.STRING },
                    tresc: { type: Type.STRING }
                  },
                  required: ["tytul", "tresc"]
                }
              }
            },
            required: ["sekcje"]
          } 
          : {
            type: Type.OBJECT,
            properties: {
              opis_sytuacji: { type: Type.STRING },
              reakcja_1: { type: Type.STRING },
              reakcja_2: { type: Type.STRING },
              reakcja_3: { type: Type.STRING },
              styl_1: { type: Type.STRING },
              styl_2: { type: Type.STRING },
              styl_3: { type: Type.STRING },
              komentarz_eksperta: { type: Type.STRING }
            },
            required: ["opis_sytuacji", "reakcja_1", "reakcja_2", "reakcja_3", "styl_1", "styl_2", "styl_3"]
          };

        const response = await genAI.models.generateContent({
          model,
          contents: newHistory.slice(-MAX_HISTORY_LENGTH),
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: responseSchemaGemini
          }
        });
        text = response.text || "";
      }

      if (!text) throw new Error("Brak prawidłowej odpowiedzi od wybranego modelu AI.");
      
      const jsonResponse = JSON.parse(text);

      setChatHistory(prev => [...prev, { role: "model", parts: [{ text }] }]);

      if (isSummaryRequest) {
        setSummary(jsonResponse.sekcje);
        setAppState('summary');
      } else {
        setCurrentTurn(jsonResponse);
        setAppState('simulation');
        
        if (turnCount > 0 && turnCount % CHECK_INTERVAL === 0) {
          setShowLimitModal(true);
        }
      }
    } catch (err: any) {
      console.error(err);
      showError(`Wystąpił błąd komunikacji: ${err.message}`);
      setChatHistory(newHistory.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = async () => {
    if (!situationInput.trim()) {
      showError("Proszę opisać początkową sytuację.");
      return;
    }
    setTurnCount(1);
    const initialPrompt = `
      Imię użytkownika: ${name || "Nie podano"}
      Zawód użytkownika: ${profession || "Nieokreślony"}
      Kontekst/Temat: ${context || "Ogólny"}
      Początkowa sytuacja: ${situationInput}
    `;
    await processTurn(initialPrompt);
  };

  const handleReaction = async (reactionText: string, style: string) => {
    setTurnCount(prev => prev + 1);
    setChosenStyles(prev => [...prev, style]);
    await processTurn(`Moja reakcja: ${reactionText} (Styl: ${style}). Jak rozwija się sytuacja i jakie są moje kolejne możliwe reakcje?`);
  };

  const handleSummaryRequest = async () => {
    setShowLimitModal(false);
    await processTurn("Zakończ symulację i stwórz eksperckie podsumowanie mojego profilu behawioralnego.", true);
  };

  const downloadJson = () => {
    if (!summary) return;
    const data = {
      user_info: { profession, context, turns: turnCount },
      reaction_styles: chosenStyles,
      psychological_profile: summary
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profil_psychologiczny_${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    // Rozwiązanie w pełni natywne, lekkie i oparte na przeglądarkowym "Drukuj do PDF", z pominięciem obcinania wysokich kontenerów
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const resetApp = () => {
    setAppState('setup');
    setSituationInput('');
    setName('');
    setProfession('');
    setContext('');
    setTurnCount(0);
    setCurrentTurn(null);
    setSummary(null);
    setChatHistory([]);
    setChosenStyles([]);
    setShowLimitModal(false);
  };

  const finishOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('onboarding_seen', 'true');
  };

  const onboardingSteps = [
    {
      title: "Witaj w Symulatorze AI!",
      description: "To narzędzie pozwoli Ci przetestować Twoje reakcje w realistycznych scenariuszach psychologicznych. Dowiesz się, jak Twoje decyzje wpływają na rozwój sytuacji.",
      icon: <Sparkles className="w-8 h-8 text-blue-500" />
    },
    {
      title: "Krok 1: Konfiguracja",
      description: "Zacznij od podania swojego profilu. Pomoże to AI dostosować scenariusz do Twoich realiów.",
      icon: <Brain className="w-8 h-8 text-blue-500" />
    },
    {
      title: "Krok 2: Symulacja",
      description: "W każdej turze otrzymasz opis sytuacji i 3 możliwe reakcje. Każda reprezentuje inny styl: zadaniowy, relacyjny lub unikający.",
      icon: <History className="w-8 h-8 text-blue-500" />
    },
    {
      title: "Krok 3: Twój Profil",
      description: "Po kilku turach otrzymasz pełny profil psychologiczny, który z łatwością wyeksportujesz do pliku PDF.",
      icon: <FileDown className="w-8 h-8 text-blue-500" />
    }
  ];

  const renderOnboarding = () => (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 md:p-12 max-w-lg w-full shadow-2xl space-y-8 relative overflow-hidden border border-slate-100 dark:border-slate-800"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-slate-100 dark:bg-slate-800">
          <motion.div 
            className="h-full bg-blue-600"
            initial={{ width: 0 }}
            animate={{ width: `${((onboardingStep + 1) / onboardingSteps.length) * 100}%` }}
          />
        </div>

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/50 rounded-3xl mb-2">
            {onboardingSteps[onboardingStep].icon}
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">{onboardingSteps[onboardingStep].title}</h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            {onboardingSteps[onboardingStep].description}
          </p>
        </div>

        <div className="flex gap-3">
          {onboardingStep > 0 && (
            <button 
              onClick={() => setOnboardingStep(prev => prev - 1)}
              className="flex-1 py-4 px-6 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Wstecz
            </button>
          )}
          <button 
            onClick={() => {
              if (onboardingStep < onboardingSteps.length - 1) {
                setOnboardingStep(prev => prev + 1);
              } else {
                finishOnboarding();
              }
            }}
            className="flex-[2] py-4 px-6 rounded-2xl font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-blue-900/20 transition-all active:scale-95"
          >
            {onboardingStep === onboardingSteps.length - 1 ? "Zaczynamy!" : "Dalej"}
          </button>
        </div>
      </motion.div>
    </div>
  );

  const renderSetup = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 p-6 md:p-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Twoje imię</label>
          <input 
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Np. Anna, Jan..."
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 transition-all bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 text-[16px]"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Twój zawód (opcjonalnie)</label>
          <input 
            type="text"
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
            placeholder="Np. Kierowca, Nauczyciel..."
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 transition-all bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 text-[16px]"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Czego dotyczy sprawa?</label>
          <input 
            type="text"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Np. Relacje rodzinne, Praca..."
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 transition-all bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 text-[16px]"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          Opisz początkową sytuację
        </label>
        <textarea 
          value={situationInput}
          onChange={(e) => setSituationInput(e.target.value)}
          placeholder="Np. Jesteś na ważnym spotkaniu i nagle zdajesz sobie sprawę, że Twoja prezentacja zniknęła z pendrive'a..."
          className="w-full min-h-[120px] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 transition-all resize-none bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 text-[16px]"
        />
      </div>
      <button 
        onClick={handleStart}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-3 group"
      >
        <span>Rozpocznij Symulację</span>
        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </button>
    </motion.div>
  );

  const renderSimulation = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="p-6 md:p-8 flex flex-col min-h-[500px]"
    >
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          <History className="w-4 h-4" />
          Tura: {turnCount}
        </div>
        <button onClick={resetApp} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-grow space-y-8">
        {currentTurn?.komentarz_eksperta && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-400 p-4 rounded-r-2xl flex gap-3 items-start"
          >
            <Brain className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">Wgląd Eksperta</span>
              <p className="text-sm text-amber-900 dark:text-amber-200/90 italic leading-relaxed">
                &quot;{currentTurn.komentarz_eksperta}&quot;
              </p>
            </div>
          </motion.div>
        )}

        <div className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 p-6 rounded-3xl text-slate-800 dark:text-slate-200 leading-relaxed text-lg italic">
          {currentTurn?.opis_sytuacji}
        </div>

        <div className="space-y-3">
          {[
            { text: currentTurn?.reakcja_1, style: currentTurn?.styl_1 },
            { text: currentTurn?.reakcja_2, style: currentTurn?.styl_2 },
            { text: currentTurn?.reakcja_3, style: currentTurn?.styl_3 }
          ].map((reaction, idx) => (
            <button
              key={idx}
              onClick={() => reaction.text && reaction.style && handleReaction(reaction.text, reaction.style)}
              className="w-full text-left p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-slate-800/50 transition-all group flex items-start gap-4"
            >
              <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                {idx + 1}
              </span>
              <div className="flex-grow">
                <span className="block text-slate-700 dark:text-slate-300 font-medium group-hover:dark:text-white transition-colors">{reaction.text}</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mt-1 block group-hover:text-blue-400 transition-colors">
                  {reaction.style}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <button 
          onClick={handleSummaryRequest}
          className="text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 font-bold text-sm flex items-center gap-2"
        >
          <Brain className="w-4 h-4" />
          Zakończ i podsumuj profil
        </button>
      </div>
    </motion.div>
  );

  const renderSummary = () => {
    const styleCounts = chosenStyles.reduce((acc, style) => {
      acc[style] = (acc[style] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const chartData = Object.entries(styleCounts).map(([name, value]) => ({ name, value }));
    const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 md:p-8 space-y-8"
      >
        <div ref={summaryRef} className="space-y-8 rounded-3xl" id="pdf-content">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-green-100 dark:bg-green-500/20 rounded-full text-green-600 dark:text-green-400 mb-2">
              <Brain className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Twój Profil Behawioralny</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Analiza na podstawie {turnCount} podjętych decyzji</p>
          </div>

          {/* Chart Section */}
          <div className="print:break-inside-avoid bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800 mb-8">
            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Dominujące Style Reakcji
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', color: theme === 'dark' ? '#f1f5f9' : '#000', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    align="center"
                    wrapperStyle={{ paddingTop: '20px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-6 pt-4">
            {summary?.map((section, idx) => (
              <div 
                key={idx} 
                className="print:break-inside-avoid bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[1.5rem] shadow-sm hover:shadow-md transition-shadow"
              >
                <h4 className="text-blue-600 dark:text-blue-500 font-black text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-500" />
                  {section.tytul}
                </h4>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm md:text-base">
                  {section.tresc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-100 dark:border-slate-800 print:hidden">
          <button 
            onClick={downloadPdf}
            className="flex-grow bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <FileDown className="w-5 h-5" />
            Pobierz Profil PDF
          </button>
          <button 
            onClick={resetApp}
            className="flex-grow bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold py-4 px-8 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Nowa Symulacja
          </button>
        </div>
      </motion.div>
    );
  };

  if (!isMounted) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" />;
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-8 transition-colors duration-300 print:bg-white print:p-0 print:block print:min-h-0">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 dark:shadow-none overflow-hidden border border-slate-100 dark:border-slate-800 relative print:shadow-none print:border-none print:rounded-none print:overflow-visible">
        
        {/* Header */}
        <div className="bg-blue-600 p-8 text-white text-center relative overflow-hidden transition-colors duration-300 print:hidden">
          <div className="absolute top-4 right-4 flex gap-2">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              title="Zmień motyw"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              title="Ustawienia"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
          
          <h1 className="text-3xl font-black tracking-tight mb-2 mt-2">Symulator Zachowań</h1>
          <p className="text-blue-100 text-sm font-medium opacity-80">
            Eksploruj psychologiczne scenariusze i konsekwencje swoich decyzji.
          </p>
        </div>

        {/* Content */}
        <div className="relative">
          <div className="relative z-10 transition-colors duration-300">
            {appState === 'setup' && renderSetup()}
            {appState === 'simulation' && renderSimulation()}
            {appState === 'summary' && renderSummary()}
          </div>

          {/* Onboarding */}
          {showOnboarding && renderOnboarding()}

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8 text-center transition-colors">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-blue-600 font-bold animate-pulse">{loadingText}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 border-2 border-red-500 dark:border-red-500 p-4 rounded-2xl flex items-center gap-4 text-slate-800 dark:text-slate-100 text-sm font-bold z-[200] shadow-2xl shadow-red-500/20 max-w-md w-[90%] animate-in fade-in slide-in-from-top-8 duration-300">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Limit Modal */}
          {showLimitModal && (
            <div className="absolute inset-0 bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 shadow-2xl max-w-sm w-full text-center space-y-6 border border-slate-100 dark:border-slate-800">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto">
                  <History className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Przerwa na refleksję!</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                    Rozegrałeś już <span className="font-bold text-slate-900 dark:text-slate-100">{turnCount}</span> tur. Analiza Twoich zachowań nabiera kształtu. Chcesz kontynuować czy zobaczyć podsumowanie?
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => setShowLimitModal(false)}
                    className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3 px-6 rounded-xl transition-colors"
                  >
                    Kontynuuj zabawę
                  </button>
                  <button 
                    onClick={handleSummaryRequest}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-blue-100 dark:shadow-none transition-all"
                  >
                    Zakończ i podsumuj
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Settings Modal */}
          {showSettings && (
            <div className="absolute inset-0 bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-sm z-[80] flex items-center justify-center p-6">
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 shadow-2xl max-w-sm w-full space-y-6 relative border border-slate-100 dark:border-slate-800">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100 mb-2">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center">
                    <Settings className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-black">Ustawienia API</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Wybierz Zespół Ekspertów</label>
                    <select
                      value={selectedModel}
                      onChange={(e) => {
                        setSelectedModel(e.target.value);
                        localStorage.setItem('selected_model', e.target.value);
                      }}
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 transition-all bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value="gemini">Google Gemini 2.5 (Błyskawiczny)</option>
                      <option value="gpt-4o-mini">OpenAI GPT-4o Mini (Szybki)</option>
                      <option value="gpt-4o">OpenAI GPT-4o (Głęboka jakość)</option>
                    </select>
                  </div>
                  
                  {selectedModel === 'gemini' ? (
                    <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200 delay-100">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-blue-600 dark:text-blue-400">Klucz API - Google Gemini</label>
                      <input 
                        type="password"
                        value={apiKey}
                        onChange={(e) => {
                          setApiKey(e.target.value);
                          localStorage.setItem('gemini_api_key', e.target.value);
                        }}
                        placeholder="Wklej klucz Gemini..."
                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 transition-all bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 text-[16px]"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Klucz jest zapisywany tylko w pamięci Twojej przeglądarki (localStorage). W tej opcji używany jest model <strong>gemini-2.5-flash-lite</strong>.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200 delay-100">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-emerald-600 dark:text-emerald-400">Klucz API - OpenAI (ChatGPT)</label>
                      <input 
                        type="password"
                        value={openaiApiKey}
                        onChange={(e) => {
                          setOpenaiApiKey(e.target.value);
                          localStorage.setItem('openai_api_key', e.target.value);
                        }}
                        placeholder="sk-proj-..."
                        className="w-full p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/30 focus:border-emerald-500 transition-all bg-emerald-50/10 dark:bg-emerald-900/10 text-slate-900 dark:text-slate-100 text-[16px]"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Klucz zapisywany tylko u Ciebie z platformy OpenAI. Zostanie użyta sieć inteligencji typu <strong>{selectedModel}</strong>.
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button 
                    onClick={downloadJson}
                    className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center gap-2 py-2"
                  >
                    <FileJson className="w-3 h-3" />
                    Pobierz ukryty plik surowy (JSON)
                  </button>
                </div>

                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-blue-100 dark:shadow-none transition-all mt-4"
                >
                  Zapisz i Zamknij
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
