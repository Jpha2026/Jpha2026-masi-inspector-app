import { useState, useEffect } from "react";
import { useColorScheme } from "react-native";

type Theme = {
  bg: string;
  card: string;
  text: string;
  textSub: string;
  border: string;
  header: string;
  isDark: boolean;
};

// Día: 6:00–19:59 → tema claro  /  Noche: 20:00–5:59 → tema oscuro
function isDarkByTime(): boolean {
  const h = new Date().getHours();
  return h < 6 || h >= 20;
}

const LIGHT: Theme = {
  isDark:  false,
  bg:      "#F4F6FB",
  card:    "#FFFFFF",
  text:    "#1A2740",
  textSub: "#5A6E8C",
  border:  "#D0D9EB",
  header:  "#122B60",
};

const DARK: Theme = {
  isDark:  true,
  bg:      "#0D1117",
  card:    "#161B22",
  text:    "#E6EDF3",
  textSub: "#8B949E",
  border:  "#30363D",
  header:  "#0D1117",
};

export function useTheme(): Theme {
  const systemScheme = useColorScheme();

  // Prefer time-based rule; fall back to system preference
  const [dark, setDark] = useState(() => isDarkByTime() || systemScheme === "dark");

  useEffect(() => {
    // Re-evaluate on hour changes
    const check = () => setDark(isDarkByTime() || systemScheme === "dark");
    check();
    const interval = setInterval(check, 60 * 1000); // check every minute
    return () => clearInterval(interval);
  }, [systemScheme]);

  return dark ? DARK : LIGHT;
}
