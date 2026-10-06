import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Home, BedDouble, FileText, LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { LayoutDashboard, CalendarDays, BarChart3, X, Users } from 'lucide-react';

export function DashboardLayout() {
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/calendar', icon: Calendar, label: 'Calendário' },
    { path: '/reservations', icon: BedDouble, label: 'Reservas' },
    { path: '/guests', icon: Users, label: 'Hóspedes' },
    { path: '/rooms', icon: BedDouble, label: 'Quartos' },
    { path: '/reports', icon: FileText, label: 'Relatórios' },
  ];

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Menu Lateral (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white shadow-xl">
        <div className="p-6 text-2xl font-bold border-b border-slate-800 tracking-wider">
          Pousada Lafevi
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        {/* Rodapé do Menu Lateral */}
        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <div className="mb-4 px-3">
            <p className="text-sm font-medium text-white truncate">{profile?.name || 'Administrador'}</p>
            <p className="text-xs text-slate-400 capitalize">{profile?.role || 'admin'}</p>
          </div>
          <button
            onClick={signOut}
            className="flex items-center space-x-3 p-3 w-full text-red-400 hover:text-red-300 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Área Principal */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Cabeçalho Mobile */}
        <header className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
          <span className="text-xl font-bold tracking-wider">Pousada Lafevi</span>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1 rounded-md hover:bg-slate-800"
          >
            <Menu size={28} />
          </button>
        </header>

        {/* Menu Mobile Expandido */}
        {isMobileMenuOpen && (
          <nav className="md:hidden bg-slate-800 text-white p-3 space-y-2 shadow-lg absolute w-full z-50">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center space-x-3 p-3 rounded-lg text-slate-200 hover:bg-slate-700"
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={signOut}
              className="flex items-center space-x-3 p-3 w-full rounded-lg text-red-400 hover:bg-slate-700"
            >
              <LogOut size={20} />
              <span className="font-medium">Sair</span>
            </button>
          </nav>
        )}

        {/* Conteúdo das Páginas */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50">
          <Outlet /> {/* É aqui que as outras páginas serão desenhadas */}
        </div>
      </main>
    </div>
  );
}