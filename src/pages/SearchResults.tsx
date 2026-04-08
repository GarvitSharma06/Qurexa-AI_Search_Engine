import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Mic, 
  Image as ImageIcon, 
  Settings, 
  User, 
  Sun, 
  Moon, 
  ArrowLeft, 
  ExternalLink, 
  Sparkles,
  Loader2,
  AlertTriangle,
  ShieldAlert
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import { SearchResult } from "../types";
import { GoogleGenAI } from "@google/genai";
import { toast } from "sonner";

interface SearchResultsProps {
  age: number | null;
}

export function SearchResults({ age }: SearchResultsProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";
  const { theme, toggleTheme } = useTheme();
  const { user, login, logout } = useAuth();
  
  const [results, setResults] = useState<SearchResult[]>([]);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAdultContent, setIsAdultContent] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [localQuery, setLocalQuery] = useState(query);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const isUnderage = age !== null && age < 18;

  const POPULAR_SEARCHES = [
    "Latest AI news",
    "How to bake a cake",
    "Best programming languages 2026",
    "Weather in New York",
    "SpaceX Mars mission update",
    "Healthy breakfast ideas",
    "Top 10 travel destinations",
    "Bitcoin price today"
  ];

  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  useEffect(() => {
    if (localQuery.trim().length > 0 && localQuery !== query) {
      const history = JSON.parse(localStorage.getItem("qurexa-history") || "[]") as { query: string }[];
      const historyQueries = Array.from(new Set(history.map(h => h.query)));
      
      const filteredHistory = historyQueries.filter(q => 
        q.toLowerCase().includes(localQuery.toLowerCase()) && q.toLowerCase() !== localQuery.toLowerCase()
      );
      
      const filteredPopular = POPULAR_SEARCHES.filter(q => 
        q.toLowerCase().includes(localQuery.toLowerCase()) && q.toLowerCase() !== localQuery.toLowerCase()
      );

      setSuggestions([...new Set([...filteredHistory, ...filteredPopular])].slice(0, 6));
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [localQuery]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (query) {
      performSearch();
      getAiAnswer();
    }
  }, [query]);

  const performSearch = async () => {
    setIsLoading(true);
    try {
      // Simple adult content check
      const adultKeywords = ["porn", "adult", "xxx", "sex", "naked", "nude"];
      const containsAdult = adultKeywords.some(kw => query.toLowerCase().includes(kw));
      
      if (containsAdult && isUnderage) {
        setIsAdultContent(true);
        setResults([]);
        setIsLoading(false);
        return;
      }

      setIsAdultContent(false);

      // Call Gemini to generate realistic search results
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Generate 8 realistic search results for the query: "${query}". 
      Each result must have:
      - title: A catchy, relevant title.
      - url: A realistic URL (e.g., wikipedia.org, news sites, official sites).
      - text: A 2-3 sentence snippet describing the page content.
      
      Return ONLY a JSON array of objects with these keys. No other text.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      let text = response.text || "[]";
      // Clean up potential markdown or extra characters if the model didn't follow JSON mode strictly
      if (text.includes("```json")) {
        text = text.split("```json")[1].split("```")[0];
      } else if (text.includes("```")) {
        text = text.split("```")[1].split("```")[0];
      }
      
      const data = JSON.parse(text.trim());
      const formattedResults = data.map((r: any) => ({
        ...r,
        score: "1.0000",
        mode: "web"
      }));

      setResults(formattedResults);
    } catch (err) {
      console.error("Search failed", err);
      toast.error("Failed to fetch search results.");
    } finally {
      setIsLoading(false);
    }
  };

  const getAiAnswer = async () => {
    if (isUnderage && isAdultContent) return;
    
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are Qurexa AI, a helpful search assistant. Provide a concise, accurate answer to the user's query: "${query}". Format with markdown. If the query is inappropriate or adult-themed, refuse politely.`,
      });
      setAiAnswer(response.text || "No answer available.");
    } catch (err) {
      console.error("AI answer failed", err);
      setAiAnswer("Sorry, I couldn't generate an AI answer at this time.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSearch = (e?: React.FormEvent, overrideQuery?: string) => {
    e?.preventDefault();
    const finalQuery = overrideQuery || localQuery;
    if (finalQuery.trim()) {
      // Save to history
      const history = JSON.parse(localStorage.getItem("qurexa-history") || "[]");
      const newItem = { id: Date.now().toString(), query: finalQuery.trim(), timestamp: Date.now() };
      const filteredHistory = history.filter((h: any) => h.query.toLowerCase() !== finalQuery.trim().toLowerCase());
      localStorage.setItem("qurexa-history", JSON.stringify([newItem, ...filteredHistory].slice(0, 50)));
      
      setShowSuggestions(false);
      navigate(`/search?q=${encodeURIComponent(finalQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-100 dark:border-zinc-900 p-4">
        <div className="max-w-7xl mx-auto flex items-center gap-8">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-white font-black text-xl">Q</span>
            </div>
            <div className="hidden md:flex flex-col items-start leading-none">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Live Clock</span>
              <span className="text-sm font-mono font-bold text-zinc-900 dark:text-white">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </Link>

          <form onSubmit={handleSearch} className="flex-1 max-w-2xl relative">
            <input 
              name="q"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              onFocus={() => localQuery.trim().length > 0 && localQuery !== query && setShowSuggestions(true)}
              type="text"
              className="w-full py-3 px-12 rounded-full bg-zinc-100 dark:bg-zinc-900 border-none focus:ring-2 focus:ring-blue-500 transition-all text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
              placeholder="Search Qurexa..."
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <Mic className="w-4 h-4 text-zinc-400 cursor-pointer hover:text-blue-500" />
              <ImageIcon className="w-4 h-4 text-zinc-400 cursor-pointer hover:text-blue-500" />
            </div>

            {/* Suggestions Dropdown */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50"
                >
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setLocalQuery(suggestion);
                        setShowSuggestions(false);
                        handleSearch(undefined, suggestion);
                      }}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left transition-colors"
                    >
                      <Search className="w-4 h-4 text-zinc-400" />
                      <span className="text-zinc-700 dark:text-zinc-300">{suggestion}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <div className="flex items-center gap-3 shrink-0">
            <button onClick={toggleTheme} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all">
              {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            {user ? (
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img src={user.photoURL} className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-800" alt={user.displayName || ""} />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                    <User className="w-4 h-4 text-zinc-400" />
                  </div>
                )}
                <button onClick={logout} className="text-xs text-red-400 hover:text-red-300">Logout</button>
              </div>
            ) : (
              <button onClick={login} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all">
                <User className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Results Column */}
        <div className="lg:col-span-8 space-y-10">
          {isAdultContent && isUnderage ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-12 bg-red-500/5 border border-red-500/20 rounded-3xl text-center space-y-6"
            >
              <div className="flex justify-center">
                <div className="p-6 bg-red-500/10 rounded-full">
                  <ShieldAlert className="w-16 h-16 text-red-500" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-red-500">Content Restricted</h2>
              <p className="text-zinc-500 max-w-md mx-auto">
                Qurexa SafeSearch has blocked this content because you are under 18. Please try a different search query.
              </p>
              <Link to="/" className="inline-flex items-center gap-2 text-blue-500 font-bold hover:underline">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Link>
            </motion.div>
          ) : (
            <>
              {/* AI Answer Section */}
              <AnimatePresence>
                {(isAiLoading || aiAnswer) && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-100 dark:border-blue-900/30 rounded-3xl shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-4 text-blue-600 dark:text-blue-400">
                      <Sparkles className="w-5 h-5" />
                      <span className="font-bold uppercase tracking-wider text-xs">Qurexa AI Answer</span>
                    </div>
                    
                    {isAiLoading ? (
                      <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <p className="animate-pulse">Thinking...</p>
                      </div>
                    ) : (
                      <div className="prose dark:prose-invert max-w-none text-zinc-900 dark:text-zinc-100">
                        <p className="text-lg leading-relaxed text-zinc-900 dark:text-zinc-100">{aiAnswer}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Search Results */}
              <div className="space-y-8">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="space-y-3 animate-pulse">
                      <div className="h-4 w-1/4 bg-zinc-100 dark:bg-zinc-900 rounded" />
                      <div className="h-6 w-3/4 bg-zinc-100 dark:bg-zinc-900 rounded" />
                      <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-900 rounded" />
                    </div>
                  ))
                ) : results.length === 0 ? (
                  <div className="text-center py-20">
                    <AlertTriangle className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                    <p className="text-zinc-500">No results found for "{query}"</p>
                  </div>
                ) : (
                      results.map((result, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="group max-w-2xl"
                        >
                          <div className="flex items-center gap-3 mb-1">
                            <div className="w-7 h-7 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                              <img 
                                src={`https://www.google.com/s2/favicons?domain=${result.url}&sz=64`} 
                                className="w-4 h-4"
                                alt=""
                                onError={(e) => (e.currentTarget.src = "https://www.google.com/s2/favicons?domain=google.com&sz=64")}
                              />
                            </div>
                            <div className="flex flex-col leading-tight">
                              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-xs">
                                {new URL(result.url.startsWith('http') ? result.url : `https://${result.url}`).hostname}
                              </span>
                              <span className="text-xs text-zinc-500 truncate max-w-xs">
                                {result.url}
                              </span>
                            </div>
                          </div>
                          
                          <a 
                            href={result.url.startsWith('http') ? result.url : `https://${result.url}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block group-hover:underline decoration-blue-600 dark:decoration-blue-400 decoration-1 underline-offset-2"
                          >
                            <h3 className="text-xl font-medium text-blue-700 dark:text-blue-400 mb-1">
                              {result.title}
                            </h3>
                          </a>
                          <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed line-clamp-2">
                            {result.text}
                          </p>
                        </motion.div>
                      ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-8">
          <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800">
            <h4 className="font-bold mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4 text-zinc-400" />
              Search Settings
            </h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">SafeSearch</span>
                <span className={cn(
                  "text-xs font-bold px-2 py-1 rounded",
                  isUnderage ? "text-green-500 bg-green-500/10" : "text-zinc-500 bg-zinc-500/10"
                )}>
                  {isUnderage ? "ON" : "OFF"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Age Verified</span>
                <span className="text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded">{age}+</span>
              </div>
            </div>
          </div>

          <div className="p-6 bg-gradient-to-br from-zinc-900 to-black rounded-3xl text-white">
            <h4 className="font-bold mb-2">Try Qurexa Pro</h4>
            <p className="text-zinc-400 text-sm mb-4">Get faster AI answers and ad-free searching.</p>
            <button className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all">
              Upgrade Now
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
