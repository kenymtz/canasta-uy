import { useEffect, useState } from "react";

// Claro u oscuro. Por defecto sigue al sistema; si la persona toca el botón, manda su elección
// (se guarda en el navegador). El script de index.html aplica el tema antes de dibujar.

export type Tema = "claro" | "oscuro";

const CLAVE = "tema";

const delSistema = (): Tema => (matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro");

function elegido(): Tema | null {
  try {
    const t = localStorage.getItem(CLAVE);
    return t === "claro" || t === "oscuro" ? t : null;
  } catch {
    return null;
  }
}

/** El tema aplicado ahora (lo lee el mapa, por ejemplo). */
export const temaActual = (): Tema => (document.documentElement.dataset.tema === "oscuro" ? "oscuro" : "claro");

function aplicar(t: Tema) {
  document.documentElement.dataset.tema = t;
}

export function useTema() {
  const [tema, setTema] = useState<Tema>(temaActual);

  useEffect(() => {
    // Mientras no haya elegido a mano, si el sistema cambia, la web también
    const sistema = matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () => {
      if (elegido()) return;
      const t = delSistema();
      aplicar(t);
      setTema(t);
    };
    sistema.addEventListener("change", alCambiar);
    return () => sistema.removeEventListener("change", alCambiar);
  }, []);

  function alternar() {
    const t: Tema = tema === "oscuro" ? "claro" : "oscuro";
    try {
      localStorage.setItem(CLAVE, t);
    } catch {
      // sin almacenamiento (modo privado): el cambio vale hasta recargar
    }
    aplicar(t);
    setTema(t);
  }

  return { tema, alternar };
}
