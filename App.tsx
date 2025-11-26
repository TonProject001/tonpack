import React, { useState } from 'react';
import { PackingStation } from './components/PackingStation';
import { Dashboard } from './components/Dashboard';
import { AppMode } from './types';
import { Video, LayoutDashboard, Settings } from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.PACKING);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-20 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-6 gap-6 z-10">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50 mb-4">
            <Video className="w-6 h-6 text-white" />
        </div>
        
        <nav className="flex flex-col gap-4 w-full px-2">
            <button 
                onClick={() => setMode(AppMode.PACKING)}
                className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl transition-all ${mode === AppMode.PACKING ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'}`}
            >
                <Video className="w-6 h-6" />
                <span className="text-[10px] font-medium">Pack</span>
            </button>

            <button 
                onClick={() => setMode(AppMode.DASHBOARD)}
                className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl transition-all ${mode === AppMode.DASHBOARD ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'}`}
            >
                <LayoutDashboard className="w-6 h-6" />
                <span className="text-[10px] font-medium">History</span>
            </button>
        </nav>

        <div className="mt-auto flex flex-col items-center gap-4">
             <button className="text-slate-600 hover:text-slate-400 transition-colors">
                <Settings className="w-6 h-6" />
             </button>
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border-2 border-slate-800"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-slate-50 relative">
        {mode === AppMode.PACKING ? <PackingStation /> : <Dashboard />}
        
        {/* Environment Notice (To simulate XAMPP/Localhost requirement) */}
        {!window.isSecureContext && window.location.hostname !== 'localhost' && (
             <div className="absolute bottom-4 right-4 bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-2 rounded-lg text-sm shadow-lg max-w-sm">
                <strong>Warning:</strong> Camera access requires HTTPS or localhost. If the camera is black, please ensure you are running this in a secure context.
             </div>
        )}
      </div>
    </div>
  );
};

export default App;