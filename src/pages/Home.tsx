import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Mic, 
  Image as ImageIcon, 
  Plus, 
  MoreHorizontal, 
  X, 
  Settings, 
  History, 
  Download, 
  User,
  Sun,
  Moon,
  Cloud,
  Navigation,
  ExternalLink,
  Trash2
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import { PinnedSite, NewsItem, WeatherData } from "../types";
import { toast } from "sonner";

interface HomeProps {
  age: number | null;
}

export function Home({ age }: HomeProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, login, logout } = useAuth();
  const [query, setQuery] = useState("");
  const [pinnedSites, setPinnedSites] = useState<PinnedSite[]>(() => {
    const saved = localStorage.getItem("qurexa-pinned");
    return saved ? JSON.parse(saved) : [
      { id: "1", name: "Google", url: "https://google.com" },
      { id: "2", name: "YouTube", url: "https://youtube.com" },
      { id: "3", name: "GitHub", url: "https://github.com" },
      { id: "4", name: "Wikipedia", url: "https://wikipedia.org" },
    ];
  });
  const [news, setNews] = useState<NewsItem[]>([]);
  const [weather, setWeather] = useState<(WeatherData & { locationName?: string }) | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDownloads, setShowDownloads] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSite, setNewSite] = useState({ name: "", url: "" });
  const [searchMode, setSearchMode] = useState<"ai" | "standard">("ai");
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
    if (query.trim().length > 0) {
      const history = JSON.parse(localStorage.getItem("qurexa-history") || "[]") as { query: string }[];
      const historyQueries = Array.from(new Set(history.map(h => h.query)));
      
      const filteredHistory = historyQueries.filter(q => 
        q.toLowerCase().includes(query.toLowerCase()) && q.toLowerCase() !== query.toLowerCase()
      );
      
      const filteredPopular = POPULAR_SEARCHES.filter(q => 
        q.toLowerCase().includes(query.toLowerCase()) && q.toLowerCase() !== query.toLowerCase()
      );

      setSuggestions([...new Set([...filteredHistory, ...filteredPopular])].slice(0, 6));
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem("qurexa-pinned", JSON.stringify(pinnedSites));
  }, [pinnedSites]);

  useEffect(() => {
    fetchNews();
    fetchWeather();
  }, []);

  const fetchNews = async () => {
    try {
      const res = await fetch("/api/news");
      const data = await res.json();
      setNews(data);
    } catch (err) {
      console.error("News fetch failed", err);
    }
  };

  const fetchWeather = async () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(`/api/weather?lat=${latitude}&lon=${longitude}`);
        const data = await res.json();
        
        // Reverse geocoding for location name with higher precision
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`);
        const geoData = await geoRes.json();
        const addr = geoData.address;
        
        // Pick the most specific location name available
        const city = addr.neighbourhood || 
                     addr.suburb || 
                     addr.village || 
                     addr.town || 
                     addr.city_district ||
                     addr.city || 
                     addr.county || 
                     "Unknown Location";
        
        setWeather({ ...data, locationName: city });
      } catch (err) {
        console.error("Weather fetch failed", err);
      }
    }, (err) => {
      console.error("Geolocation error:", err);
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  };

  const handleSearch = (e?: React.FormEvent, overrideQuery?: string) => {
    e?.preventDefault();
    const finalQuery = overrideQuery || query;
    if (!finalQuery.trim()) return;
    
    // Save to history
    const history = JSON.parse(localStorage.getItem("qurexa-history") || "[]");
    const newItem = { id: Date.now().toString(), query: finalQuery.trim(), timestamp: Date.now() };
    
    // Remove duplicates
    const filteredHistory = history.filter((h: any) => h.query.toLowerCase() !== finalQuery.trim().toLowerCase());
    localStorage.setItem("qurexa-history", JSON.stringify([newItem, ...filteredHistory].slice(0, 50)));
    
    navigate(`/search?q=${encodeURIComponent(finalQuery.trim())}`);
  };

  const addPinnedSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSite.name && newSite.url) {
      const url = newSite.url.startsWith("http") ? newSite.url : `https://${newSite.url}`;
      setPinnedSites(prev => [...prev, { id: Date.now().toString(), name: newSite.name, url }]);
      setNewSite({ name: "", url: "" });
      setShowAddModal(false);
      toast.success("Site pinned!");
    }
  };

  const removePinnedSite = (id: string) => {
    setPinnedSites(pinnedSites.filter(s => s.id !== id));
  };

  const startVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice search not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.onstart = () => setIsVoiceActive(true);
    recognition.onend = () => setIsVoiceActive(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      navigate(`/search?q=${encodeURIComponent(transcript)}`);
    };
    recognition.start();
  };

  const handleImageSearch = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        toast.info("Visual search is analyzing your image...");
        // In a real app, you'd upload this to an AI service
        setTimeout(() => {
          setQuery("Similar images to " + file.name);
          navigate(`/search?q=${encodeURIComponent("visual search " + file.name)}`);
        }, 2000);
      }
    };
    input.click();
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center overflow-x-hidden">
      {/* Background Image (Edge Style) */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-950 dark:to-zinc-900" />
      <div className="fixed inset-0 -z-10 opacity-30 dark:opacity-20 pointer-events-none">
        <img 
          src="https://picsum.photos/seed/qurexa/1920/1080?blur=10" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Top Bar */}
      <header className="w-full p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
            <span className="text-sm font-mono font-bold tracking-wider text-zinc-900 dark:text-white">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {weather && (
            <div className="hidden md:flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
              <Cloud className="w-4 h-4 text-blue-400" />
              <div className="flex flex-col items-start leading-none">
                <span className="text-[10px] text-zinc-400 font-bold uppercase">{weather.locationName}</span>
                <span className="text-sm font-medium">{weather.current_weather.temperature}°C</span>
              </div>
            </div>
          )}
          <button 
            onClick={toggleTheme}
            className="p-2.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 hover:bg-white/20 transition-all"
          >
            {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 hover:bg-white/20 transition-all"
          >
            <Settings className="w-5 h-5" />
          </button>
          {user ? (
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-1 pr-4 rounded-full border border-white/20">
              {user.photoURL ? (
                <img src={user.photoURL} className="w-8 h-8 rounded-full" alt={user.displayName || ""} />
              ) : (
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                  <User className="w-4 h-4 text-zinc-400" />
                </div>
              )}
              <span className="text-sm font-medium">{user.displayName || "User"}</span>
              <button onClick={logout} className="ml-2 text-xs text-red-400 hover:text-red-300">Logout</button>
            </div>
          ) : (
            <button 
              onClick={login}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full font-medium transition-all shadow-lg shadow-blue-500/20"
            >
              <User className="w-4 h-4" />
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Search Section */}
      <main className="flex-1 w-full max-w-4xl px-6 flex flex-col items-center justify-center py-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-12"
        >
          <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/40">
            <span className="text-white font-black text-4xl md:text-5xl">Q</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            Qurexa
          </h1>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full relative group max-w-2xl"
        >
          <div className="flex items-center gap-4 mb-4 ml-4">
            <button 
              onClick={() => setSearchMode("ai")}
              className={cn(
                "text-xs font-bold px-3 py-1 rounded-full transition-all",
                searchMode === "ai" ? "bg-blue-600 text-white" : "bg-white/10 text-zinc-400 hover:bg-white/20"
              )}
            >
              AI Search
            </button>
            <button 
              onClick={() => setSearchMode("standard")}
              className={cn(
                "text-xs font-bold px-3 py-1 rounded-full transition-all",
                searchMode === "standard" ? "bg-zinc-800 text-white" : "bg-white/10 text-zinc-400 hover:bg-white/20"
              )}
            >
              Standard
            </button>
          </div>

          <form onSubmit={handleSearch} className="relative">
            <input 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.trim().length > 0 && setShowSuggestions(true)}
              placeholder={searchMode === "ai" ? "Search with Qurexa AI..." : "Enter a query..."}
              className="w-full py-5 px-14 rounded-3xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/20 dark:border-zinc-800 shadow-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all text-lg text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
            />
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-400" />
            
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <AnimatePresence>
                {query && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setSuggestions([]);
                      setShowSuggestions(false);
                    }}
                    className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                )}
              </AnimatePresence>
              
              <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-1" />

              <button 
                type="button"
                onClick={startVoiceSearch}
                className={cn(
                  "p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all",
                  isVoiceActive && "text-red-500 animate-pulse bg-red-500/10"
                )}
              >
                <Mic className="w-5 h-5" />
              </button>
              <button 
                type="button"
                onClick={handleImageSearch}
                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
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
                        setQuery(suggestion);
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
        </motion.div>

        {/* Pinned Sites */}
        <div className="mt-12 grid grid-cols-4 md:grid-cols-8 gap-6 w-full">
          {pinnedSites.map((site) => (
            <motion.div 
              key={site.id}
              whileHover={{ scale: 1.05 }}
              className="relative group flex flex-col items-center gap-2"
            >
              <a 
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all shadow-lg"
              >
                <img 
                  src={`https://www.google.com/s2/favicons?domain=${site.url}&sz=64`} 
                  className="w-8 h-8"
                  alt={site.name}
                />
              </a>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate w-full text-center">
                {site.name}
              </span>
              <button 
                onClick={() => removePinnedSite(site.id)}
                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowAddModal(true);
            }}
            className="flex flex-col items-center gap-2 group cursor-pointer relative z-10"
          >
            <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 border-dashed flex items-center justify-center group-hover:bg-white/20 transition-all">
              <Plus className="w-6 h-6 text-zinc-400 pointer-events-none" />
            </div>
            <span className="text-xs font-medium text-zinc-500 pointer-events-none">Add</span>
          </button>
        </div>
      </main>

      {/* MSN Style News Feed (Bottom) */}
      <section className="w-full max-w-6xl px-6 pb-20">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Trending News</h2>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-sm font-medium border border-white/20">Politics</button>
            <button className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-sm font-medium border border-white/20">Tech</button>
            <button className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-sm font-medium border border-white/20">Sports</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {news.map((item, i) => (
            <motion.a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl overflow-hidden hover:bg-white/20 transition-all"
            >
              <div className="aspect-video bg-zinc-800 relative overflow-hidden">
                <img 
                  src={`https://picsum.photos/seed/${item.title.slice(0, 5)}/800/450`} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-4 left-4 bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                  {item.source}
                </div>
              </div>
              <div className="p-6">
                <h3 className="font-bold text-lg leading-tight mb-2 line-clamp-2 group-hover:text-blue-500 transition-colors">
                  {item.title}
                </h3>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{new Date(item.pubDate).toLocaleDateString()}</span>
                  <ExternalLink className="w-3 h-3" />
                </div>
              </div>
            </motion.a>
          ))}
        </div>
      </section>

      {/* Modals */}
      <AnimatePresence>
        {showSettings && (
          <Modal title="Settings" onClose={() => setShowSettings(false)}>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
                <div>
                  <h4 className="font-bold">Safe Search</h4>
                  <p className="text-sm text-zinc-500">{isUnderage ? "Enforced for minors" : "Filter adult content"}</p>
                </div>
                <div className={cn(
                  "w-12 h-6 rounded-full relative transition-colors",
                  isUnderage ? "bg-blue-600" : "bg-zinc-400"
                )}>
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                    isUnderage ? "right-1" : "left-1"
                  )} />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
                <div>
                  <h4 className="font-bold">Face Recognition</h4>
                  <p className="text-sm text-zinc-500">Always verify on startup</p>
                </div>
                <div className="w-12 h-6 bg-blue-600 rounded-full relative">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                </div>
              </div>
              <button 
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="w-full py-4 text-red-500 font-bold border border-red-500/20 rounded-2xl hover:bg-red-500/10 transition-all"
              >
                Reset All Data
              </button>
            </div>
          </Modal>
        )}

        {showHistory && (
          <Modal title="Search History" onClose={() => setShowHistory(false)}>
            <HistoryList />
          </Modal>
        )}
        {showDownloads && (
          <Modal title="Downloads" onClose={() => setShowDownloads(false)}>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Download className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Qurexa_Setup.exe</p>
                    <p className="text-[10px] text-zinc-500">15.4 MB • Completed</p>
                  </div>
                </div>
                <button className="text-xs font-bold text-blue-500 hover:underline">Open</button>
              </div>
              <p className="text-center text-zinc-500 py-4 text-xs italic">Mock downloads for demonstration</p>
            </div>
          </Modal>
        )}

        {showAddModal && (
          <Modal title="Add Pinned Site" onClose={() => setShowAddModal(false)}>
            <form onSubmit={addPinnedSite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Site Name</label>
                <input 
                  type="text" 
                  required
                  value={newSite.name}
                  onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                  className="w-full p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Google"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">URL</label>
                <input 
                  type="text" 
                  required
                  value={newSite.url}
                  onChange={(e) => setNewSite({ ...newSite, url: e.target.value })}
                  className="w-full p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. google.com"
                />
              </div>
              <button 
                type="submit"
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-all"
              >
                Add Site
              </button>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-4">
        <button 
          onClick={() => setShowHistory(true)}
          className="p-4 bg-white dark:bg-zinc-900 shadow-2xl rounded-full border border-zinc-200 dark:border-zinc-800 hover:scale-110 transition-all"
        >
          <History className="w-6 h-6" />
        </button>
        <button 
          onClick={() => setShowDownloads(true)}
          className="p-4 bg-white dark:bg-zinc-900 shadow-2xl rounded-full border border-zinc-200 dark:border-zinc-800 hover:scale-110 transition-all"
        >
          <Download className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-bottom border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}

function HistoryList() {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("qurexa-history");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const deleteItem = (id: string) => {
    const newHistory = history.filter(h => h.id !== id);
    setHistory(newHistory);
    localStorage.setItem("qurexa-history", JSON.stringify(newHistory));
  };

  return (
    <div className="space-y-4">
      {history.length === 0 ? (
        <p className="text-center text-zinc-500 py-8">No history yet</p>
      ) : (
        history.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl group">
            <div className="flex items-center gap-4">
              <Search className="w-4 h-4 text-zinc-400" />
              <div>
                <p className="font-medium">{item.query}</p>
                <p className="text-xs text-zinc-500">{new Date(item.timestamp).toLocaleString()}</p>
              </div>
            </div>
            <button onClick={() => deleteItem(item.id)} className="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
