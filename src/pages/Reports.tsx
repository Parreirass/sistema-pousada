import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format, parseISO, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
// import { ptBR } from 'date-fns/locale';
import { Download, TrendingUp, CalendarDays, BedDouble, DollarSign } from 'lucide-react';

type Room = { id: string; name: string };
type Reservation = {
  id: string; check_in: string; check_out: string; 
  guest_name: string; guest_count: number; total_price: number; 
  status: string; room_id: string; room: { name: string };
};

export function Reports() {
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  
  // Filtros (Padrão: mês atual)
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Métricas
  const [metrics, setMetrics] = useState({
    totalReservations: 0,
    totalNights: 0,
    expectedRevenue: 0,
    occupancyRate: 0
  });

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate, selectedRoom, selectedStatus]);

  async function fetchRooms() {
    const { data } = await supabase.from('rooms').select('id, name').eq('status', 'active');
    if (data) setRooms(data);
  }

  async function fetchReports() {
    setLoading(true);
    
    let query = supabase
      .from('reservations')
      .select('*, room:rooms(name)')
      .gte('check_in', startDate)
      .lte('check_in', endDate);

    if (selectedRoom) query = query.eq('room_id', selectedRoom);
    if (selectedStatus) query = query.eq('status', selectedStatus);

    const { data } = await query;

    if (data) {
      const res = data as unknown as Reservation[];
      setReservations(res);

      // Calcular Métricas (Ignorando canceladas para faturamento e noites)
      const validRes = res.filter(r => r.status !== 'cancelled');
      
      const totalRes = validRes.length;
      const revenue = validRes.reduce((acc, curr) => acc + curr.total_price, 0);
      const nights = validRes.reduce((acc, curr) => {
        const d = differenceInDays(parseISO(curr.check_out), parseISO(curr.check_in));
        return acc + (d > 0 ? d : 0);
      }, 0);

      // Taxa de ocupação simples = (Noites Vendidas / (Total de Quartos * Dias no Período)) * 100
      const daysInPeriod = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
      const roomCountToUse = selectedRoom ? 1 : (rooms.length || 1);
      const possibleNights = roomCountToUse * daysInPeriod;
      const occupancy = possibleNights > 0 ? Math.min(100, Math.round((nights / possibleNights) * 100)) : 0;

      setMetrics({
        totalReservations: totalRes,
        totalNights: nights,
        expectedRevenue: revenue,
        occupancyRate: occupancy
      });
    }
    setLoading(false);
  }

  // Função para exportar CSV compatível com Excel brasileiro
  const exportToCSV = () => {
    if (reservations.length === 0) {
      alert("Não há dados para exportar nesse período.");
      return;
    }

    // Cabeçalhos
    const headers = ['ID', 'Hóspede', 'Quarto', 'Check-in', 'Check-out', 'Noites', 'Qtd Hóspedes', 'Valor Total', 'Status'];
    
    // Montar linhas
    const rows = reservations.map(r => {
      const nights = differenceInDays(parseISO(r.check_out), parseISO(r.check_in));
      return [
        r.id,
        `"${r.guest_name}"`, // Aspas para evitar quebra se tiver vírgula no nome
        `"${r.room?.name || ''}"`,
        format(parseISO(r.check_in), 'dd/MM/yyyy'),
        format(parseISO(r.check_out), 'dd/MM/yyyy'),
        nights,
        r.guest_count,
        r.total_price.toString().replace('.', ','), // Formato brasileiro de decimais
        r.status
      ].join(';'); // Separador ponto-e-vírgula para Excel em PT-BR
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_pousada_${startDate}_a_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-500 mt-1">Acompanhe os resultados da sua pousada.</p>
        </div>
        <button 
          onClick={exportToCSV}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium transition"
        >
          <Download size={20} /> Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Inicial</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Final</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quarto</label>
          <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg outline-none">
            <option value="">Todos os Quartos</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg outline-none">
            <option value="">Todos os Status</option>
            <option value="confirmed">Confirmadas</option>
            <option value="hosted">Hospedados</option>
            <option value="finished">Finalizadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 text-blue-600 mb-2"><CalendarDays size={20} /><span className="font-medium text-gray-600">Reservas (Válidas)</span></div>
          <p className="text-3xl font-bold text-gray-900">{metrics.totalReservations}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 text-indigo-600 mb-2"><BedDouble size={20} /><span className="font-medium text-gray-600">Diárias Vendidas</span></div>
          <p className="text-3xl font-bold text-gray-900">{metrics.totalNights}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 text-green-600 mb-2"><DollarSign size={20} /><span className="font-medium text-gray-600">Faturamento</span></div>
          <p className="text-3xl font-bold text-gray-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.expectedRevenue)}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 text-orange-600 mb-2"><TrendingUp size={20} /><span className="font-medium text-gray-600">Ocupação Média</span></div>
          <p className="text-3xl font-bold text-gray-900">{metrics.occupancyRate}%</p>
        </div>
      </div>

      {/* Tabela de Resultados do Filtro */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Buscando dados...</div>
        ) : reservations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhuma reserva encontrada para os filtros aplicados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm uppercase">
                <tr>
                  <th className="p-4 font-medium">Hóspede</th>
                  <th className="p-4 font-medium">Quarto</th>
                  <th className="p-4 font-medium">Entrada</th>
                  <th className="p-4 font-medium">Saída</th>
                  <th className="p-4 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {reservations.map(res => (
                  <tr key={res.id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-900">{res.guest_name}</td>
                    <td className="p-4 text-gray-600">{res.room?.name}</td>
                    <td className="p-4 text-gray-600">{format(parseISO(res.check_in), 'dd/MM/yyyy')}</td>
                    <td className="p-4 text-gray-600">{format(parseISO(res.check_out), 'dd/MM/yyyy')}</td>
                    <td className="p-4 text-gray-900 font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res.total_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}