import React, { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Truck, MapPin, Users, Building, Calculator, Navigation2, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  'AIzaSyADUVuZmKsMnvyDugnOCp8w0nI74VtF0Nw';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

// TYPES
type PlaceData = {
  name: string;
  location: google.maps.LatLngLiteral;
};

// --- COMPONENTS ---

// 1. Splash Screen if API Key is missing
function SplashScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800 p-6 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full text-center border border-slate-100">
        <div className="bg-yellow-100 text-yellow-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-2xl font-bold mb-4">Google Maps API Key Required</h2>
        <p className="text-slate-600 mb-6">You need an active Google Maps API key with Routes API and Places API (New) enabled to run this application.</p>
        <div className="text-left bg-slate-50 p-4 rounded-lg mb-6 text-sm">
          <p className="font-semibold mb-2">How to add it:</p>
          <ol className="list-decimal pl-5 space-y-2 text-slate-700">
            <li>Open <strong>Settings</strong> (⚙️ gear icon, top right)</li>
            <li>Select <strong>Secrets</strong></li>
            <li>Type <code>GOOGLE_MAPS_PLATFORM_KEY</code></li>
            <li>Paste your API key and press Enter</li>
          </ol>
        </div>
        <p className="text-xs text-slate-400">The app will automatically rebuild once the key is provided.</p>
      </div>
    </div>
  );
}

// 2. Autocomplete Input Component
function AutocompleteInput({ 
  placeholder, 
  onPlaceSelected, 
  icon: Icon
}: { 
  placeholder: string; 
  onPlaceSelected: (place: PlaceData | null) => void;
  icon: React.ElementType;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const placesLib = useMapsLibrary('places');

  const onPlaceSelectedRef = useRef(onPlaceSelected);
  useEffect(() => {
    onPlaceSelectedRef.current = onPlaceSelected;
  }, [onPlaceSelected]);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;

    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'geometry', 'name'],
    });

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place || !place.geometry || !place.geometry.location) {
        onPlaceSelectedRef.current(null);
        return;
      }
      onPlaceSelectedRef.current({
        name: place.formatted_address || place.name || '',
        location: { 
          lat: place.geometry.location.lat(), 
          lng: place.geometry.location.lng() 
        }
      });
    });

    return () => {
      google.maps.event.removeListener(listener);
      // Clean up autocomplete instances implicitly handled by GMaps API when input is removed
    };
  }, [placesLib]);

  return (
    <div className="relative h-[46px]">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 z-10 flex items-center pointer-events-none">
        <Icon size={18} />
      </div>
      <input 
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        className="w-full h-full bg-white border border-transparent rounded-lg focus-within:ring-2 focus-within:ring-orange-500 transition-all pl-10 pr-4 text-slate-800 shadow-inner outline-none"
      />
    </div>
  );
}

// 3. Routing Map Component
function RouteMapDisplay({ 
  origin, 
  destination, 
  onRouteCalculated,
  onRouteError
}: {
  origin: google.maps.LatLngLiteral | null;
  destination: google.maps.LatLngLiteral | null;
  onRouteCalculated: (distanceMeters: number | null) => void;
  onRouteError: (error: string | null) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService>();
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer>();

  useEffect(() => {
    if (!routesLib || !map) return;
    const renderer = new routesLib.DirectionsRenderer({ 
      map,
      polylineOptions: {
        strokeColor: '#f97316',
        strokeOpacity: 0.8,
        strokeWeight: 5
      }
    });
    setDirectionsService(new routesLib.DirectionsService());
    setDirectionsRenderer(renderer);

    return () => {
      renderer.setMap(null);
    };
  }, [routesLib, map]);

  useEffect(() => {
    if (!directionsService || !directionsRenderer) return;

    let active = true;

    if (!origin || !destination) {
      directionsRenderer.setDirections({routes: []} as any);
      onRouteError(null);
      return;
    }
    
    onRouteError(null);
    onRouteCalculated(null); // Reset distance while calculating

    directionsService.route({
      origin,
      destination,
      travelMode: 'DRIVING' as google.maps.TravelMode
    })
    .then(response => {
      if (!active) return;
      directionsRenderer.setDirections(response);
      const route = response.routes[0];
      if (route?.legs?.[0]?.distance?.value !== undefined) {
         onRouteCalculated(route.legs[0].distance.value);
      } else {
         onRouteCalculated(0);
      }
    })
    .catch(err => {
      if (!active) return;
      console.error("Failed to compute route", err);
      onRouteError(err.message || "Erro ao calcular a rota. Verifique se a 'Directions API' e a 'Routes API' estão ativadas no Google Cloud Console.");
      onRouteCalculated(0);
    });

    return () => {
      active = false;
    };
  }, [directionsService, directionsRenderer, origin, destination, onRouteCalculated, onRouteError]);

  // Center map on origin if only origin is present
  useEffect(() => {
    if (map && origin && !destination) {
      map.panTo(origin);
      map.setZoom(14);
    }
  }, [map, origin, destination]);

  return null;
}

// 4. Main Calculator Logic
function FreightCalculator() {
  const [origin, setOrigin] = useState<PlaceData | null>(null);
  const [destination, setDestination] = useState<PlaceData | null>(null);
  const [helpers, setHelpers] = useState<number>(0);
  const [floors, setFloors] = useState<number>(0);

  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [isCalculated, setIsCalculated] = useState(false);

  // Business Logic Constants
  const BASE_FEE = 80;
  const PER_KM_FEE = 6;
  const HELPER_FEE = 70;
  const STAIR_FEE_PER_HELPER_PER_FLOOR = 10;

  // Calculables
  const distanceKm = distanceMeters ? (distanceMeters / 1000) : 0;
  const distanceRoundTripKm = distanceKm * 2;
  const travelCost = distanceRoundTripKm * PER_KM_FEE;
  
  const helpersBaseCost = helpers * HELPER_FEE;
  const totalFloors = floors;
  const stairsCost = helpers * totalFloors * STAIR_FEE_PER_HELPER_PER_FLOOR;
  const helpersTotalCost = helpersBaseCost + stairsCost;

  const totalCost = BASE_FEE + travelCost + helpersTotalCost;

  const handleCalculate = () => {
    if (origin && destination && distanceMeters) {
      setIsCalculated(true);
      // Smooth scroll to results
      setTimeout(() => {
         document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const getWhatsAppLink = () => {
    const formatCurrency = (val: number) => `R$ ${val.toFixed(2).replace('.', ',')}`;
    const msg = `Olá! Vim pelo app Frete Fácil. Gostaria de agendar um frete:\n\n📍 *Origem:* ${origin?.name}\n📍 *Destino:* ${destination?.name}\n👷 *Ajudantes:* ${helpers}\n🏢 *Andares:* ${totalFloors}\n\n💰 *Orçamento Estimado:* ${formatCurrency(totalCost)}\n\nPodemos confirmar?`;
    
    return `https://wa.me/5521975151937?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,#1e293b_0%,#0a0f1d_100%)] text-white flex flex-col md:flex-row font-sans overflow-x-hidden">
      
      {/* Sidebar */}
      <aside className="w-full md:w-[380px] shrink-0 bg-white/10 backdrop-blur-[20px] md:border-r border-b md:border-b-0 border-white/15 p-6 md:p-8 flex flex-col gap-5 md:h-screen md:overflow-y-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
             <Truck className="text-white" size={24} />
          </div>
          <span className="font-bold text-2xl tracking-tight text-white">FRETE FÁCIL</span>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[12px] uppercase tracking-[0.05em] text-slate-400 font-semibold block">Endereço de Partida</label>
          <AutocompleteInput 
            placeholder="Digite o endereço de origem" 
            icon={MapPin} 
            onPlaceSelected={(place) => {
              setOrigin(place);
              setIsCalculated(false);
            }} 
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[12px] uppercase tracking-[0.05em] text-slate-400 font-semibold block">Endereço de Destino</label>
          <AutocompleteInput 
            placeholder="Digite o endereço de destino" 
            icon={MapPin} 
            onPlaceSelected={(place) => {
              setDestination(place);
              setIsCalculated(false);
            }} 
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[12px] uppercase tracking-[0.05em] text-slate-400 font-semibold block">Ajudantes</label>
          <input 
            type="number" 
            min="0"
            value={helpers}
            onChange={(e) => {
              setHelpers(parseInt(e.target.value) || 0);
              setIsCalculated(false);
            }}
            className="w-full h-[46px] bg-black/20 border border-white/15 rounded-lg p-3 text-white text-[14px] outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[12px] uppercase tracking-[0.05em] text-slate-400 font-semibold block">Total de Andares (Origem + Destino)</label>
          <input 
            type="number" 
            min="0"
            value={floors}
            onChange={(e) => {
              setFloors(parseInt(e.target.value) || 0);
              setIsCalculated(false);
            }}
            className="w-full h-[46px] bg-black/20 border border-white/15 rounded-lg p-3 text-white text-[14px] outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
          />
        </div>

        <button
          onClick={handleCalculate}
          disabled={!origin || !destination}
          className="w-full bg-orange-500 disabled:opacity-50 text-white p-4 rounded-xl font-bold uppercase mt-4 hover:bg-orange-600 transition-opacity"
        >
          {distanceMeters === null && origin && destination && !routingError ? 'Calculando Rota...' : 'Calcular Frete'}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 flex flex-col gap-8 justify-center overflow-y-auto md:h-screen w-full relative z-10 max-w-4xl mx-auto">
        
        {/* Map Preview */}
        <div className="h-[280px] bg-slate-800 rounded-[20px] border border-white/15 relative overflow-hidden shrink-0 shadow-lg">
           {!origin && !destination && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                 O mapa será exibido aqui
              </div>
           )}
           <Map
              defaultCenter={{ lat: -22.880, lng: -42.020 }}
              defaultZoom={9}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              disableDefaultUI={true}
              gestureHandling="cooperative"
           >
              <RouteMapDisplay 
                origin={origin?.location || null} 
                destination={destination?.location || null}
                onRouteCalculated={setDistanceMeters}
                onRouteError={setRoutingError}
              />
           </Map>
           
           {routingError && (
             <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg font-semibold shadow-lg z-50 max-w-[90%] text-center text-sm border-2 border-red-700 pointer-events-none">
               {routingError}
               <br/>
               <span className="text-xs font-normal">Ative a "Directions API" na Plataforma Google Maps.</span>
             </div>
           )}
        </div>

        {/* Results Section */}
        {isCalculated && (
          <div id="results-section" className="bg-white/95 text-slate-900 rounded-[24px] p-6 md:p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-4 duration-500 w-full shrink-0">
             
             <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-200 pb-4 mb-5 gap-4">
                <div>
                   <span className="text-[13px] text-slate-500 tracking-wide block mb-1">Valor Total Estimado</span>
                   <div className="text-4xl md:text-[42px] font-bold text-slate-900 leading-none">R$ {totalCost.toFixed(2).replace('.', ',')}</div>
                </div>
                <div className="md:text-right">
                   <span className="text-[13px] text-slate-500 tracking-wide block mb-1">Distância Total (I/V)</span>
                   <div className="text-[16px] font-semibold text-slate-800">{distanceRoundTripKm.toFixed(1).replace('.', ',')} km</div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-4">
                <div>
                   <div className="text-[13px] text-slate-500">Deslocamento</div>
                   <div className="text-[16px] font-semibold text-slate-800 mb-3">R$ {(travelCost + BASE_FEE).toFixed(2).replace('.', ',')}</div>
                   
                   <div className="text-[13px] text-slate-500">Mão de Obra ({helpers} ajudantes)</div>
                   <div className="text-[16px] font-semibold text-slate-800 mb-3">R$ {helpersBaseCost.toFixed(2).replace('.', ',')}</div>
                </div>
                <div>
                   <div className="text-[13px] text-slate-500">Taxa de Escadas ({totalFloors} andares)</div>
                   <div className="text-[16px] font-semibold text-slate-800 mb-3">R$ {stairsCost.toFixed(2).replace('.', ',')}</div>
                </div>
             </div>

             <div className="bg-orange-50 border-l-4 border-orange-500 p-3 text-[12px] text-orange-900 mt-6 md:mt-4 rounded-r-md">
                <strong>Aviso:</strong> Valores de pedágio não estão inclusos neste orçamento e são de responsabilidade do contratante.
             </div>

             <a 
               href={getWhatsAppLink()} 
               target="_blank" 
               rel="noopener noreferrer"
               className="bg-green-500 text-white w-full p-[18px] rounded-[14px] font-bold flex items-center justify-center gap-[10px] mt-6 shadow-[0_10px_20px_rgba(34,197,94,0.3)] hover:scale-[1.02] transition-transform animate-[pulse_2s_infinite]"
             >
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                   <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                Agendar Frete pelo WhatsApp
             </a>
          </div>
        )}
      </main>
    </div>
  );
}

// 5. Main App Component
export default function App() {
  if (!hasValidKey) {
    return <SplashScreen />;
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <FreightCalculator />
    </APIProvider>
  );
}

