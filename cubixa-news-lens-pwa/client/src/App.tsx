import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import SharedResult from "./pages/SharedResult";
import HistoryPage from "./pages/HistoryPage";


function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      {/* PWA share_target lands here; Home reads URL search params on mount */}
      <Route path={"/share"} component={Home} />
      {/* Permanent shareable analysis result (QR + copied links) */}
      <Route path={"/r/:id"} component={SharedResult} />
      {/* Local archive of past analyses with search + sort */}
      <Route path={"/history"} component={HistoryPage} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
