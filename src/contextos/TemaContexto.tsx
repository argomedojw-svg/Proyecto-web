/**
 * Tema claro/oscuro con persistencia en localStorage.
 * El valor inicial ya lo aplica un script en index.html para que no haya
 * destello al cargar; aquí solo se mantiene sincronizado.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CLAVES, escribir, leer } from '@/lib/almacenamiento';

export type Tema = 'claro' | 'oscuro';

type ValorTema = {
  tema: Tema;
  alternar: () => void;
  establecer: (tema: Tema) => void;
};

const Contexto = createContext<ValorTema | null>(null);

function temaInicial(): Tema {
  const guardado = leer<Tema | null>(CLAVES.tema, null);
  if (guardado === 'claro' || guardado === 'oscuro') return guardado;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'oscuro';
  }
  return 'claro';
}

export function ProveedorTema({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    escribir(CLAVES.tema, tema);
  }, [tema]);

  const establecer = useCallback((nuevo: Tema) => setTema(nuevo), []);
  const alternar = useCallback(() => setTema((t) => (t === 'claro' ? 'oscuro' : 'claro')), []);

  const valor = useMemo(() => ({ tema, alternar, establecer }), [tema, alternar, establecer]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usarTema(): ValorTema {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('usarTema debe usarse dentro de <ProveedorTema>');
  return valor;
}
