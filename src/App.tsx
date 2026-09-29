import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Rooms } from './pages/Rooms';
import { Reservations } from './pages/Reservations';
import { CalendarPage } from './pages/CalendarPage';
import { Dashboard } from './pages/Dashboard';
import { Reports } from './pages/Reports';

// Proteção de rotas
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

// Telas temporárias (Vamos criá-las de verdade nos próximos passos)
//function Home() { return <div><h1 className="text-3xl font-bold text-gray-800">Dashboard</h1><p className="text-gray-500 mt-2">Em construção...</p></div>; }
//function CalendarPage() { return <div><h1 className="text-3xl font-bold text-gray-800">Calendário</h1></div>; }
//function Reports() { return <div><h1 className="text-3xl font-bold text-gray-800">Relatórios</h1><p className="text-gray-500 mt-2">Página de relatórios em breve...</p></div>; } // <-- ADICIONE ESTA LINHA

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Tudo que está dentro do DashboardLayout terá o menu lateral */}
      <Route path="/" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="rooms" element={<Rooms />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="reports" element={<Reports />} /> {/* <-- ADICIONE ESTA LINHA */}
        <Route path="reservations" element={<Reservations />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;