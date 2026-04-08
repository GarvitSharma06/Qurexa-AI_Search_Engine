export interface SearchResult {
  url: string;
  title: string;
  text: string;
  snippet?: string;
  score: string;
  mode: string;
}

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

export interface WeatherData {
  current_weather: {
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
    time: string;
  };
}

export interface PinnedSite {
  id: string;
  name: string;
  url: string;
  icon?: string;
}

export interface HistoryItem {
  id: string;
  query: string;
  timestamp: number;
}

export interface DownloadItem {
  id: string;
  name: string;
  url: string;
  timestamp: number;
}
