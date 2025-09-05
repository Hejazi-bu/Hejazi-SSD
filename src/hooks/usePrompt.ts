import { useEffect, useContext } from "react";
import { UNSAFE_NavigationContext as NavigationContext } from "react-router-dom";
import type { To } from "react-router-dom";

export function usePrompt(message: string, when = true) {
  const { navigator } = useContext(NavigationContext);

  useEffect(() => {
    if (!when) {
      return;
    }

    const push = navigator.push;

    const customPush = (to: To, state?: unknown) => {
      const result = window.confirm(message);
      if (result) {
        push(to, state);
      }
    };

    (navigator as any).push = customPush;

    return () => {
      (navigator as any).push = push;
    };
  }, [navigator, message, when]);
}