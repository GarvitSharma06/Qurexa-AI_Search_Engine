import { useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate, useSearchParams } from "react-router-dom";
import { Home } from "./pages/Home";
import { SearchResults } from "./pages/SearchResults";
import { FaceGate } from "./components/FaceGate";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "sonner";

export default function App() {
  const [isVerified, setIsVerified] = useState(false);
  const [age, setAge] = useState<number | null>(null);

  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          {!isVerified ? (
            <FaceGate onVerified={(age) => {
              setIsVerified(true);
              setAge(age);
            }} />
          ) : (
            <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
              <Routes>
                <Route path="/" element={<Home age={age} />} />
                <Route path="/search" element={<SearchResults age={age} />} />
              </Routes>
            </div>
          )}
          <Toaster position="bottom-right" />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}
