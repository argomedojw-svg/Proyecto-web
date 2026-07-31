/**
 * Rutas de la aplicación.
 *
 * HashRouter a propósito: la app se sirve desde un servidor estático local y no
 * hay reescritura de rutas en el servidor. Con hash funciona igual con
 * `npm run preview` que con cualquier otro servidor estático.
 */

import { Suspense, lazy } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProveedorTema } from '@/contextos/TemaContexto';
import { Disposicion } from '@/componentes/Disposicion';
import { Cargando, NoEncontrado } from '@/componentes/Estados';
import { Inicio } from '@/paginas/Inicio';
import { PaginaCategoria } from '@/paginas/PaginaCategoria';
import { PaginaTrastorno } from '@/paginas/PaginaTrastorno';

/* Las pantallas menos usadas se cargan aparte para no engordar el arranque. */
const PaginaBusqueda = lazy(() =>
  import('@/paginas/PaginaBusqueda').then((m) => ({ default: m.PaginaBusqueda })),
);
const PaginaComparador = lazy(() =>
  import('@/paginas/PaginaComparador').then((m) => ({ default: m.PaginaComparador })),
);
const PaginaEstudio = lazy(() =>
  import('@/paginas/PaginaEstudio').then((m) => ({ default: m.PaginaEstudio })),
);

function Respaldo() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Cargando lineas={6} etiqueta="Cargando la pantalla…" />
    </div>
  );
}

export function App() {
  return (
    <ProveedorTema>
      <HashRouter>
        <Routes>
          <Route element={<Disposicion />}>
            <Route index element={<Inicio />} />
            <Route path="c/:categoriaId" element={<PaginaCategoria />} />
            <Route path="t/:categoriaId/:trastornoId" element={<PaginaTrastorno />} />
            <Route
              path="buscar"
              element={
                <Suspense fallback={<Respaldo />}>
                  <PaginaBusqueda />
                </Suspense>
              }
            />
            <Route
              path="comparar"
              element={
                <Suspense fallback={<Respaldo />}>
                  <PaginaComparador />
                </Suspense>
              }
            />
            <Route
              path="estudio"
              element={
                <Suspense fallback={<Respaldo />}>
                  <PaginaEstudio />
                </Suspense>
              }
            />
            <Route
              path="*"
              element={
                <div className="mx-auto max-w-4xl px-4 py-8">
                  <NoEncontrado
                    que="esa página"
                    detalle="Comprueba la dirección o vuelve al índice."
                  />
                </div>
              }
            />
          </Route>
          <Route path="/index.html" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ProveedorTema>
  );
}
