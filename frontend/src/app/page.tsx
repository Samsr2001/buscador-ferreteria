'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [busqueda, setBusqueda] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Detectar preferencia del sistema al inicio
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);
  interface Producto { id: number; nombre: string; precio: number; imagen_url?: string; sku: string; marca?: string; stock: number; descripcion?: string; }
  const [resultados, setResultados] = useState<Producto[] | null>(null);
  const [sustitutos, setSustitutos] = useState<Producto[] | null>(null);
  const [complementarios, setComplementarios] = useState<Producto[] | null>(null);
  const [tips, setTips] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCatalogMode, setIsCatalogMode] = useState(false);
  const [showSucursales, setShowSucursales] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [dropdownAbierto, setDropdownAbierto] = useState(false);

  const categoriasMenu = [
    { id: 'Todas', nombre: 'Todas las Categorías' },
    { id: 'Herramientas', nombre: 'Herramientas' },
    { id: 'Materiales', nombre: 'Materiales e Insumos' },
    { id: 'Plomeria', nombre: 'Plomería' },
    { id: 'Tornilleria', nombre: 'Tornillería' }
  ];

  // Fetch tutorial para todos los productos en pantalla
  useEffect(() => {
    const todosLosProductos = [
      ...(resultados || []),
      ...(sustitutos || []),
      ...(complementarios || [])
    ];
    
    if (todosLosProductos.length > 0) {
      todosLosProductos.forEach(async (producto) => {
        if (!tips[producto.id]) {
          try {
            const baseUrl = '';
            const res = await fetch(`${baseUrl}/api/buscar/tutorial?producto=${encodeURIComponent(producto.nombre)}`);
            if (res.ok) {
              const data = await res.json();
              if (data.tip) {
                setTips(prev => ({ ...prev, [producto.id]: data.tip }));
              }
            } else {
              setTips(prev => ({ ...prev, [producto.id]: 'Tip: Usa herramientas adecuadas y equipo de protección.' }));
            }
          } catch (e) {
            setTips(prev => ({ ...prev, [producto.id]: 'Tip: Usa herramientas adecuadas y equipo de protección.' }));
          }
        }
      });
    }
  }, [resultados, sustitutos, complementarios]);

  const [isListening, setIsListening] = useState(false);

  const iniciarDictado = () => {
    // @ts-ignore
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Tu navegador no soporta búsqueda por voz.");
      return;
    }
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setBusqueda(transcript);
      buscarProductos(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleSubirFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setLoading(true);
      setError(null);
      setResultados(null);
      setSustitutos(null);
      setComplementarios(null);
      setIsCatalogMode(false);
      setBusqueda('Analizando imagen con IA...');
      
      try {
        const apiUrl = '/api/buscar';
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64String }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al analizar la imagen');
        }

        const data = await res.json();
        setResultados(data.productos || []);
        setSustitutos(data.sustitutos || []);
        setComplementarios(data.complementarios || []);
        
        if (data.inferredQuery) {
          setBusqueda(data.inferredQuery);
        } else {
          setBusqueda('✨ ¡Búsqueda visual completada!');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setBusqueda('');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const buscarProductos = async (termino: string) => {
    const trimmed = termino.trim();
    if (!trimmed || trimmed.length < 2) return;
    
    setLoading(true);
    setError(null);
    setResultados(null);
    setSustitutos(null);
    setComplementarios(null);
    setIsCatalogMode(false);

    try {
      const apiUrl = '/api/buscar';
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.detalle || 'Error al conectar con la IA');
      }

      const data = await res.json();
      setResultados(data.productos || []);
      setSustitutos(data.sustitutos || []);
      setComplementarios(data.complementarios || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogo = async (categoria = 'Todas') => {
    setLoading(true);
    setError(null);
    setResultados(null);
    setBusqueda('');
    setIsCatalogMode(true);
    setFiltroCategoria(categoria);
    try {
      const baseUrl = '';
      const catParam = categoria !== 'Todas' ? '?categoria=' + encodeURIComponent(categoria) : '';
      const res = await fetch(baseUrl + '/api/productos' + catParam);
      if (!res.ok) throw new Error('Error al cargar catalogo');
      const data = await res.json();
      setResultados(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="bg-slate-50 dark:bg-zinc-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-50 via-slate-50 to-slate-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 font-sans text-slate-800 dark:text-slate-100 min-h-screen flex flex-col transition-colors duration-300">
      {/* Navigation Bar */}
      <nav className="w-full bg-white dark:bg-zinc-900/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 shadow-sm fixed top-0 z-50 transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between py-3 sm:h-16 items-center gap-3 sm:gap-0">
            <div className="flex items-center gap-2">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879a3 3 0 11-4.242-4.242l2.879-2.879m0 0L10 10m2 2l-2-2"></path>
              </svg>
              <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-zinc-100 dark:text-white">Ferre<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500">Buscador</span></span>
            </div>
            <div className="flex space-x-4 sm:space-x-8 text-sm sm:text-base font-medium items-center">
              <button onClick={() => { setResultados(null); setBusqueda(''); setIsCatalogMode(false); }} className="text-slate-700 dark:text-zinc-300 dark:text-slate-300 dark:text-zinc-600 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">Inicio</button>
              <button onClick={() => fetchCatalogo()} className="text-slate-700 dark:text-zinc-300 dark:text-slate-300 dark:text-zinc-600 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">Catálogo</button>
              <button onClick={() => setShowSucursales(true)} className="text-slate-700 dark:text-zinc-300 dark:text-slate-300 dark:text-zinc-600 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">Ferreterías</button>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 ml-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-zinc-300 dark:text-slate-300 dark:text-zinc-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">{isDarkMode ? '☀️' : '🌙'}</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Header / Hero */}
      <header className="w-full pt-32 pb-16 px-4 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Decorative background blob */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-orange-500/10 blur-[100px] rounded-full pointer-events-none -z-10"></div>
        
        <div className="mb-6 p-4 bg-orange-50 rounded-2xl border border-orange-100 dark:border-orange-500/30 shadow-sm animate-bounce-slow">
          <svg className="w-12 h-12 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879a3 3 0 11-4.242-4.242l2.879-2.879m0 0L10 10m2 2l-2-2"></path>
          </svg>
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold text-center mb-6 tracking-tight text-slate-900 dark:text-zinc-100 drop-shadow-md">
          Ferre<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600">Buscador</span> AI
        </h1>
        <p className="text-base md:text-xl text-slate-500 dark:text-zinc-400 max-w-3xl text-center mb-10 font-light leading-relaxed">
          Buscador Inteligente. Describe el repuesto con tus propias palabras y nuestra IA hará el resto.
        </p>

        {/* Search Bar with Glassmorphism */}
        <div className="w-full max-w-3xl relative z-10 hover:shadow-2xl transition-all duration-500 rounded-2xl group">
          <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <div className="relative bg-white dark:bg-zinc-900/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-xl">
            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
              <svg className="w-7 h-7 text-slate-400 dark:text-zinc-500 group-focus-within:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              type="text"
              className="block w-full pl-16 pr-[220px] py-5 text-xl bg-transparent border-0 rounded-2xl text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              placeholder="Ej: la piecita de metal para ajustar tubos..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscarProductos(busqueda)}
            />
            
            {/* Multimodal Buttons */}
            <div className="absolute right-36 top-1/2 -translate-y-1/2 flex gap-1 sm:gap-2 items-center">
              <button 
                onClick={iniciarDictado} 
                className={`p-2.5 rounded-xl transition-all ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 hover:text-orange-500'}`}
                title="Buscar por voz"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
              </button>
              
              <label className="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 hover:text-orange-500 transition-all cursor-pointer" title="Subir foto">
                <input type="file" hidden accept="image/*" onChange={handleSubirFoto} />
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              </label>
            </div>

            <button
              onClick={() => buscarProductos(busqueda)}
              disabled={loading || busqueda.trim().length < 2}
              className="absolute right-2 top-2 bottom-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold px-8 text-lg rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-orange-500/40 border border-orange-400/50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Buscando</span>
                </>
              ) : 'Buscar'}
            </button>
          </div>
        </div>

        {/* Píldoras de Búsqueda Sugerida */}
        <div className="w-full max-w-3xl mt-6 flex flex-wrap justify-center gap-2 lg:gap-3 z-10">
          <span className="text-sm text-slate-400 dark:text-zinc-500 font-medium mr-2 flex items-center">Prueba con:</span>
          <button 
            onClick={() => { setBusqueda('algo para tapar huecos en la pared'); buscarProductos('algo para tapar huecos en la pared'); }}
            className="text-xs sm:text-sm bg-white dark:bg-zinc-900/60 hover:bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:text-orange-600 border border-slate-200 hover:border-orange-300 px-4 py-2 rounded-full transition-all shadow-sm hover:shadow"
          >
            "algo para tapar huecos..."
          </button>
          <button 
            onClick={() => { setBusqueda('la piecita para que el agua no gotee'); buscarProductos('la piecita para que el agua no gotee'); }}
            className="text-xs sm:text-sm bg-white dark:bg-zinc-900/60 hover:bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:text-orange-600 border border-slate-200 hover:border-orange-300 px-4 py-2 rounded-full transition-all shadow-sm hover:shadow"
          >
            "la piecita para que el agua no gotee"
          </button>
          <button 
            onClick={() => { setBusqueda('el plástico negro para tapar cables pelados'); buscarProductos('el plástico negro para tapar cables pelados'); }}
            className="text-xs sm:text-sm bg-white dark:bg-zinc-900/60 hover:bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:text-orange-600 border border-slate-200 hover:border-orange-300 px-4 py-2 rounded-full transition-all shadow-sm hover:shadow hidden sm:block"
          >
            "el plástico negro para tapar cables..."
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 flex-1">
        
        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg mb-8 shadow-sm">
            <div className="flex items-center">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              <div className="ml-3"><p className="text-sm text-red-700 font-medium">Error de conexion: {error}</p></div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {resultados === null && !loading && !error && (
          <div className="text-center py-20">
            <div className="inline-block p-6 bg-white dark:bg-zinc-900 rounded-full shadow-sm mb-6 border border-slate-100">
              <svg className="w-16 h-16 mx-auto text-slate-300 dark:text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
              </svg>
              <p className="text-xl text-slate-500 dark:text-zinc-400 font-light">Tu catalogo inteligente esta listo para buscar.</p>
            </div>
          </div>
        )}

        {/* Resultados */}
        {resultados && !loading && (
          <div className="mb-6 pb-4">
            {isCatalogMode ? (
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900/90 backdrop-blur-xl p-6 rounded-2xl shadow-lg border-slate-100 dark:border-zinc-800 border border-slate-200">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-900 dark:text-zinc-100 dark:text-white dark:text-zinc-100 tracking-tight">📦 Catalogo Completo</h2>
                  <p className="text-slate-500 dark:text-zinc-400 mt-1">Explora el stock por categorias.</p>
                </div>
                <div 
                  className="relative"
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                      setDropdownAbierto(false);
                    }
                  }}
                >
                  <button
                    onClick={() => setDropdownAbierto(!dropdownAbierto)}
                    className="flex items-center justify-between w-full sm:w-64 px-4 py-3 text-base border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 sm:text-sm rounded-xl bg-white dark:bg-zinc-900 hover:bg-slate-50 text-slate-700 dark:text-zinc-300 font-medium cursor-pointer shadow-sm transition-all duration-200"
                  >
                    <span>{categoriasMenu.find(c => c.id === filtroCategoria)?.nombre || 'Todas las Categorías'}</span>
                    <svg className={`h-5 w-5 text-slate-400 dark:text-zinc-500 transition-transform duration-200 ${dropdownAbierto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </button>
                  
                  {dropdownAbierto && (
                    <div className="absolute z-10 w-full mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      {categoriasMenu.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            fetchCatalogo(cat.id);
                            setDropdownAbierto(false);
                          }}
                          className={`block w-full text-left px-4 py-3 text-sm transition-colors duration-150 ${
                            filtroCategoria === cat.id 
                              ? 'bg-orange-50 text-orange-700 font-semibold' 
                              : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-100'
                          }`}
                        >
                          {cat.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 px-2">Resultados encontrados:</h2>
            )}
          </div>
        )}

        <div className="grid gap-6">
          {resultados && resultados.length > 0 && resultados.map((producto, idx) => (
            <div key={idx} className="bg-white dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-md hover:shadow-2xl hover:shadow-orange-500/10 hover:-translate-y-2 transition-all duration-500 overflow-hidden border border-slate-100 flex flex-col md:flex-row group">
              {/* Product Image */}
              <div className="md:w-1/3 lg:w-1/4 h-64 md:h-auto bg-slate-50 dark:bg-zinc-800 flex-shrink-0 flex items-center justify-center p-6 border-b md:border-b-0 md:border-r border-slate-100 overflow-hidden">
                {producto.imagen_url ? (
                  <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <div className="text-slate-300 dark:text-zinc-600 flex flex-col items-center">
                    <svg className="w-20 h-20 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                    </svg>
                    <span className="text-xs font-medium uppercase tracking-wider">Sin foto</span>
                  </div>
                )}
              </div>
              
              {/* Product Details */}
              <div className="p-6 md:p-8 flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-start mb-3">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 leading-tight">{producto.nombre}</h2>
                  <span className="text-2xl font-black text-orange-600 bg-orange-50 dark:bg-orange-900/30 px-4 py-1.5 rounded-xl border border-orange-100 dark:border-orange-500/30 shadow-sm whitespace-nowrap ml-4">${producto.precio}</span>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-5">
                  <span className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 dark:text-zinc-300 text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider border border-slate-200">SKU: {producto.sku}</span>
                  <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-lg tracking-wider border border-indigo-100">Marca: {producto.marca || 'Genérica'}</span>
                  
                  {/* Stock Dinámico Premium */}
                  {producto.stock > 20 ? (
                    <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-lg tracking-wider flex items-center gap-1.5 border border-emerald-200 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Stock Ideal: {producto.stock}
                    </span>
                  ) : producto.stock > 0 ? (
                    <span className="bg-amber-50 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-lg tracking-wider flex items-center gap-1.5 border border-amber-200 animate-pulse shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      ¡Últimas {producto.stock}!
                    </span>
                  ) : (
                    <span className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-xs font-bold px-3 py-1.5 rounded-lg tracking-wider flex items-center gap-1.5 border border-rose-200 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      Agotado
                    </span>
                  )}
                </div>
                
                <p className="text-slate-600 dark:text-zinc-300 leading-relaxed text-base">{producto.descripcion}</p>
                
                {/* Tip del Experto / Mini-tutorial */}
                {tips[producto.id] && (
                  <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 rounded-xl p-4 flex gap-3">
                    <span className="text-xl">👷‍♂️</span>
                    <div>
                      <span className="font-bold text-amber-900 dark:text-amber-400 text-sm block mb-1">Tip de uso / Seguridad:</span>
                      <p className="text-amber-800 dark:text-amber-300 text-sm leading-relaxed">{tips[producto.id]}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Productos Complementarios (Venta Cruzada) */}
          {complementarios && complementarios.length > 0 && !loading && (
            <div className="mt-8 mb-8 p-6 bg-emerald-50 dark:bg-emerald-950 rounded-3xl border border-emerald-100 dark:border-emerald-800 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-2xl">🛠️</span>
                <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-300">Para tu proyecto también vas a necesitar:</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {complementarios.map((comp: Producto) => (
                  <div key={`comp-${comp.id}`} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 dark:border-zinc-800 hover:border-emerald-200 dark:hover:border-emerald-600 cursor-pointer">
                    <div className="w-16 h-16 bg-slate-50 rounded-xl overflow-hidden flex-shrink-0">
                      {comp.imagen_url ? (
                        <img src={comp.imagen_url} alt={comp.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-zinc-600">
                          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-zinc-100 leading-tight">{comp.nombre}</h4>
                      <div className="text-orange-600 font-black text-sm mt-1">${comp.precio}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sin Resultados */}
          {resultados && resultados.length === 0 && !loading && (
            <div className="text-center py-10 bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-slate-100 mb-8">
              <span className="text-5xl mb-6 block">😢</span>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-zinc-100 mb-3">No encontramos resultados exactos</h3>
              <p className="text-slate-500 dark:text-zinc-400 text-lg">Intenta describir el repuesto con otras palabras o selecciona otra categoría.</p>
            </div>
          )}

          {/* Sustitutos Recomendados */}
          {sustitutos && sustitutos.length > 0 && !loading && (
            <div className="mt-8">
              <div className="mb-6 flex items-center gap-3">
                <span className="text-3xl">💡</span>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">Alternativas sugeridas por IA</h3>
              </div>
              {sustitutos.map((producto: Producto) => (
                <div key={`sus-${producto.id}`} className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border-2 border-indigo-100 overflow-hidden flex flex-col md:flex-row hover:shadow-md transition-shadow relative">
                  <div className="absolute top-4 right-4 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3 py-1 rounded-full">Sustituto Recomendado</div>
                  
                  {/* Product Image */}
                  <div className="w-full md:w-64 h-56 md:h-auto bg-slate-50 dark:bg-zinc-800 flex items-center justify-center border-b md:border-b-0 md:border-r border-slate-100 relative overflow-hidden">
                    {producto.imagen_url ? (
                      <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-slate-300 dark:text-zinc-600 flex flex-col items-center">
                        <svg className="w-16 h-16 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        <span className="text-xs font-medium uppercase tracking-wider">Sin foto</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Product Details */}
                  <div className="p-6 md:p-8 flex-1 flex flex-col justify-center">
                    <div className="flex justify-between items-start mb-3 mt-4 md:mt-0">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 leading-tight pr-24">{producto.nombre}</h2>
                      <span className="text-2xl font-black text-orange-600 bg-orange-50 dark:bg-orange-900/30 px-4 py-1.5 rounded-xl border border-orange-100 dark:border-orange-500/30 shadow-sm whitespace-nowrap">${producto.precio}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-5">
                      <span className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 dark:text-zinc-300 text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider">SKU: {producto.sku}</span>
                      <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-lg tracking-wider">Marca: {producto.marca || 'Genérica'}</span>
                      <span className={`${producto.stock > 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'} text-xs font-bold px-3 py-1.5 rounded-lg tracking-wider flex items-center gap-1`}>
                        <span className={`w-2 h-2 rounded-full ${producto.stock > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        Stock: {producto.stock}
                      </span>
                    </div>
                    
                    <p className="text-slate-600 dark:text-zinc-300 leading-relaxed text-base">{producto.descripcion}</p>
                    
                    {/* Tip del Experto / Mini-tutorial */}
                    {tips[producto.id] && (
                      <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 rounded-xl p-4 flex gap-3">
                        <span className="text-xl">👷‍♂️</span>
                        <div>
                          <span className="font-bold text-amber-900 dark:text-amber-400 text-sm block mb-1">Tip de uso / Seguridad:</span>
                          <p className="text-amber-800 dark:text-amber-300 text-sm leading-relaxed">{tips[producto.id]}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal Sucursales */}
      {showSucursales && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm transition-opacity p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col transform transition-all">
            <div className="bg-orange-600 p-6 sm:p-8 flex justify-between items-center text-white relative overflow-hidden">
              <div className="absolute -right-4 -top-10 opacity-10">
                <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M21 13v-2h-3V8h-2v3h-3v2h3v3h2v-3h3zM10 18H5v-2h5v2zm0-4H5v-2h5v2zm0-4H5V8h5v2zM3 22V4a2 2 0 012-2h14a2 2 0 012 2v18l-3-3-3 3-3-3-3 3-3-3-3 3z"/></svg>
              </div>
              <h3 className="text-3xl font-extrabold flex items-center gap-3 relative z-10">
                Ferreterias Asociadas
              </h3>
              <button onClick={() => setShowSucursales(false)} className="text-white hover:bg-orange-500 p-2 rounded-full transition-colors relative z-10">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="p-6 sm:p-8 space-y-6">
              <p className="text-slate-500 dark:text-zinc-400 font-medium mb-2">Retira tus compras online en cualquiera de nuestros comercios asociados:</p>
              
              <div className="flex gap-5 items-start bg-slate-50 dark:bg-zinc-800 p-5 rounded-2xl border border-slate-100 hover:border-orange-200 transition-colors cursor-default">
                <div className="bg-orange-100 text-orange-600 p-3.5 rounded-xl shadow-sm mt-1">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Ferreteria Don Manolo</h4>
                    <span className="bg-indigo-100 text-indigo-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md">Asociada</span>
                  </div>
                  <p className="text-slate-600 dark:text-zinc-300">Av. Directorio 1543, CABA</p>
                  <p className="text-sm text-emerald-600 font-bold mt-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Abierto ahora - Hasta las 20:00
                  </p>
                </div>
              </div>

              <div className="flex gap-5 items-start bg-slate-50 dark:bg-zinc-800 p-5 rounded-2xl border border-slate-100 hover:border-orange-200 transition-colors cursor-default">
                <div className="bg-slate-200 text-slate-600 dark:text-zinc-300 p-3.5 rounded-xl shadow-sm mt-1">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-xl font-bold text-slate-900 dark:text-zinc-100">El Tornillo Loco</h4>
                    <span className="bg-indigo-100 text-indigo-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md">Asociada</span>
                  </div>
                  <p className="text-slate-600 dark:text-zinc-300">Calle Falsa 123, Springfield</p>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 font-bold mt-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span> Lunes a Viernes de 09:00 a 18:00
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

