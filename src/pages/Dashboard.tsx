import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BedDouble, CheckCircle2, LogIn, LogOut, CalendarDays } from 'lucide-react';

type Reservation = {
  id: string; check_in: string; check_out: string; 
  guest_name: string; status: string; room: { name: string };
  guest?: { name: string }; // <-- ADICIONE ESTA LINHA AQUI
};

export function Dashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Indicadores
  const [totalRooms, setTotalRooms] = useState(0);
  const [occupiedToday, setOccupiedToday] = useState(0);
  const [checkInsToday, setCheckInsToday] = useState(0);
  const [checkOutsToday, setCheckOutsToday] = useState(0);
  const [upcomingRes, setUpcomingRes] = useState<Reservation[]>([]);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Saudação dinâmica (Bom dia, Boa tarde, Boa noite)
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);

    // 1. Busca total de quartos ativos
    const { count: roomsCount } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    const total = roomsCount || 0;
    setTotalRooms(total);

    // 2. Busca reservas relevantes (que terminam hoje ou depois)
    const { data: resData } = await supabase
      .from('reservations')
      .select('*, room:rooms(name), guest:guests(name)')
      .neq('status', 'cancelled')
      .gte('check_out', todayStr)
      .order('check_in', { ascending: true });

    if (resData) {
      const reservations = resData as unknown as Reservation[];

      // Lógica dos Indicadores
      const occupied = reservations.filter(r => r.check_in <= todayStr && r.check_out > todayStr).length;
      const checkIns = reservations.filter(r => r.check_in === todayStr).length;
      const checkOuts = reservations.filter(r => r.check_out === todayStr).length;
      
      // Próximas reservas (começam hoje ou no futuro) limitadas a 5
      const upcoming = reservations.filter(r => r.check_in >= todayStr).slice(0, 5);

      setOccupiedToday(occupied);
      setCheckInsToday(checkIns);
      setCheckOutsToday(checkOuts);
      setUpcomingRes(upcoming);
    }

    setLoading(false);
  }

  const availableRooms = totalRooms - occupiedToday;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Cabeçalho de Boas-vindas */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {greeting}, {profile?.name?.split(' ')[0] || 'Administrador'}! 👋
          </h1>
          <p className="text-gray-500 mt-1 capitalize text-lg">
            Hoje, {format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Carregando seus indicadores...</div>
      ) : (
        <>
          {/* Grid de Cards (Raio-X do Dia) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Card: Total de Quartos */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-gray-100 text-gray-600 rounded-lg"><BedDouble size={24} /></div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Quartos</p>
                <p className="text-2xl font-bold text-gray-900">{totalRooms}</p>
              </div>
            </div>

            {/* Card: Ocupados Hoje */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><CalendarDays size={24} /></div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Ocupados</p>
                <p className="text-2xl font-bold text-gray-900">{occupiedToday}</p>
              </div>
            </div>

            {/* Card: Disponíveis Hoje */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-green-100 text-green-600 rounded-lg"><CheckCircle2 size={24} /></div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Disponíveis</p>
                <p className="text-2xl font-bold text-gray-900">{availableRooms}</p>
              </div>
            </div>

            {/* Card: Check-ins Hoje */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-yellow-100 text-yellow-600 rounded-lg"><LogIn size={24} /></div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Check-ins</p>
                <p className="text-2xl font-bold text-gray-900">{checkInsToday}</p>
              </div>
            </div>

            {/* Card: Check-outs Hoje */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-orange-100 text-orange-600 rounded-lg"><LogOut size={24} /></div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Check-outs</p>
                <p className="text-2xl font-bold text-gray-900">{checkOutsToday}</p>
              </div>
            </div>
          </div>

          {/* Lista de Próximas Reservas */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-8">
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Próximas Reservas (Chegando em breve)</h2>
            </div>
            
            {upcomingRes.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Nenhuma reserva futura encontrada.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500 text-sm">
                      <th className="p-4 font-medium">Hóspede</th>
                      <th className="p-4 font-medium">Quarto</th>
                      <th className="p-4 font-medium">Check-in</th>
                      <th className="p-4 font-medium">Check-out</th>
                      <th className="p-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {upcomingRes.map((res) => (
                      <tr key={res.id} className="hover:bg-gray-50">
                        <td className="p-4 font-semibold text-gray-900">{res.guest?.name || res.guest_name}</td>
                        <td className="p-4 text-gray-600">{res.room.name}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-sm font-medium ${res.check_in === todayStr ? 'bg-yellow-100 text-yellow-800' : 'text-gray-600'}`}>
                            {res.check_in === todayStr ? 'Hoje' : format(parseISO(res.check_in), 'dd/MM/yyyy')}
                          </span>
                        </td>
                        <td className="p-4 text-gray-600">{format(parseISO(res.check_out), 'dd/MM/yyyy')}</td>
                        <td className="p-4">
                          <span className="text-xs font-bold uppercase text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {res.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}