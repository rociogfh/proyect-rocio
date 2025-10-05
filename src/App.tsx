import { useEffect, useState } from "react";
import "./App.css";

function App() {
  // Estado para mostrar splash
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Simula una pequeña carga
    const timer = setTimeout(() => setReady(true), 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="app">
      {/* Splash Screen */}
      {!ready && (
        <div className="splash">
          <img src="/icons/icon-192.png" alt="Logo" />
          <p>Cargando...</p>
        </div>
      )}

      {/* App Shell (estructura base) */}
      {ready && (
        <>
          <header className="app-header">Proyecto Rocío Garcia</header>

          <main className="app-content">
            <h1>Bienvenido 👋</h1>
            <p>Esta es mi vista inicial (Home) de PWA.</p>
            <p>Funciona rápido y puede cargarse sin internet.</p>
          </main>

          <footer className="app-footer">© {new Date().getFullYear()}</footer>
        </>
      )}
    </div>
  );
}

export default App;
