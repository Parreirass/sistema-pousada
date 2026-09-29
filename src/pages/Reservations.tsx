import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, X, AlertCircle } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

type Room = { id: string; name: string; capacity: number; default_price: number };
type Reservation = {
  id: string;
  room_id: string;
  guest_name: string;
  guest_count: number;
  check_in: string;
  check_out: string;
  daily_rate: number;
  total_price: number;
  status: 'reserved' | 'confirmed' | 'hosted' | 'finished' | 'cancelled';
  room: { name: string };
};

export function Reservations() {
  const { profile } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState('');

  // Estados do formulário
  const [editingId, setEditingId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestCount, setGuestCount] = useState<number | ''>('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [dailyRate, setDailyRate] = useState<number | ''>('');
  const [totalPrice, setTotalPrice] = useState<number | ''>('');
  const [status, setStatus] = useState<Reservation['status']>('confirmed');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: roomsData } = await supabase.from('rooms').select('*').eq('status', 'active');
    if (roomsData) setRooms(roomsData);

    const { data: resData } = await supabase
      .from('reservations')
      .select('*, room:rooms(name)')
      .order('check_in', { ascending: true });
    
    if (resData) setReservations(resData as unknown as Reservation[]);
    setLoading(false);
  }

  // Função para calcular valor automaticamente apenas quando o usuário alterar algo
  function handleDateOrRoomChange(rId: string, inDate: string, outDate: string) {
    if (rId && inDate && outDate) {
      const selectedRoom = rooms.find(r => r.id === rId);
      if (selectedRoom) {
        setDailyRate(selectedRoom.default_price);
        const days = differenceInDays(parseISO(outDate), parseISO(inDate));
        if (days > 0) {
          setTotalPrice(days * selectedRoom.default_price);
        } else {
          setTotalPrice('');
        }
      }
    }
  }

  function openModal(res?: Reservation) {
    setError('');
    if (res) {
      // MODO EDIÇÃO
      setEditingId(res.id);
      setRoomId(res.room_id);
      setGuestName(res.guest_name);
      setGuestCount(res.guest_count);
      setCheckIn(res.check_in);
      setCheckOut(res.check_out);
      setDailyRate(res.daily_rate);
      setTotalPrice(res.total_price);
      setStatus(res.status);
    } else {
      // MODO NOVA RESERVA
      setEditingId(null);
      setRoomId(''); setGuestName(''); setGuestCount('');
      setCheckIn(''); setCheckOut(''); setDailyRate(''); setTotalPrice('');
      setStatus('confirmed');
    }
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validação de datas
    if (differenceInDays(parseISO(checkOut), parseISO(checkIn)) <= 0) {
      setError("A data de saída deve ser depois da entrada.");
      return;
    }

    const reservationData = {
      room_id: roomId,
      guest_name: guestName,
      guest_count: Number(guestCount),
      check_in: checkIn,
      check_out: checkOut,
      daily_rate: Number(dailyRate),
      total_price: Number(totalPrice),
      status,
      // Se for novo, registra quem criou
      ...(editingId ? {} : { created_by: profile?.id })
    };

    if (editingId) {
      // ATUALIZAR
      const { error: updateError } = await supabase
        .from('reservations')
        .update(reservationData)
        .eq('id', editingId);
        
      if (updateError) setError(updateError.message);
      else { setIsModalOpen(false); fetchData(); }
    } else {
      // INSERIR
      const { error: insertError } = await supabase
        .from('reservations')
        .insert([reservationData]);
        
      if (insertError) setError(insertError.message);
      else { setIsModalOpen(false); fetchData(); }
    }
  }

  // Cores dinâmicas para o status
  const statusColors = {
    reserved: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    hosted: 'bg-green-100 text-green-800',
    finished: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800 text-line-through',
  };

  const statusLabels = {
    reserved: 'Reservada',
    confirmed: 'Confirmada',
    hosted: 'Hospedado',
    finished: 'Finalizada',
    cancelled: 'Cancelada',
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Reservas</h1>
        <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium">
          <Plus size={20} /> Nova Reserva
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Carregando...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm uppercase">
                <th className="p-4 font-medium">Hóspede</th>
                <th className="p-4 font-medium">Quarto</th>
                <th className="p-4 font-medium">Período</th>
                <th className="p-4 font-medium">Valor Total</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reservations.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Nenhuma reserva encontrada.</td></tr>
              ) : (
                reservations.map((res) => (
                  <tr key={res.id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-900">{res.guest_name}</td>
                    <td className="p-4 text-gray-700">{res.room.name}</td>
                    <td className="p-4 text-gray-700">
                      {new Date(res.check_in).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até <br/>
                      {new Date(res.check_out).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </td>
                    <td className="p-4 text-gray-700">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res.total_price)}
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[res.status]}`}>
                        {statusLabels[res.status]}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => openModal(res)} className="text-blue-600 hover:text-blue-800 p-2 rounded-md hover:bg-blue-50">
                        <Edit2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DE RESERVA (NOVA OU EDIÇÃO) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? 'Editar Reserva' : 'Nova Reserva'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm flex items-center gap-2 font-medium">
                  <AlertCircle size={20} className="shrink-0" /> 
                  <span className="leading-tight">{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Hóspede *</label>
                  <input type="text" required value={guestName} onChange={(e) => setGuestName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status da Reserva</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500">
                    <option value="reserved">Reservada (Aguardando Sinal)</option>
                    <option value="confirmed">Confirmada</option>
                    <option value="hosted">Hóspede na Pousada</option>
                    <option value="finished">Finalizada (Check-out feito)</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-3 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quarto *</label>
                  <select required value={roomId} onChange={(e) => { setRoomId(e.target.value); handleDateOrRoomChange(e.target.value, checkIn, checkOut); }} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500">
                    <option value="">Selecione...</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name} (Cap: {r.capacity})</option>)}
                  </select>
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Entrada *</label>
                  <input type="date" required value={checkIn} onChange={(e) => { setCheckIn(e.target.value); handleDateOrRoomChange(roomId, e.target.value, checkOut); }} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Saída *</label>
                  <input type="date" required value={checkOut} onChange={(e) => { setCheckOut(e.target.value); handleDateOrRoomChange(roomId, checkIn, e.target.value); }} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Qtd Hóspedes *</label>
                  <input type="number" required min="1" value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor da Diária (R$)</label>
                  <input type="number" step="0.01" required value={dailyRate} onChange={(e) => setDailyRate(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-lg outline-none bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Total (R$) *</label>
                  <input type="number" step="0.01" required value={totalPrice} onChange={(e) => setTotalPrice(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-lg outline-none bg-white font-bold text-blue-700" />
                  <p className="text-xs text-gray-500 mt-1">Sinta-se livre para alterar (descontos).</p>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm">
                  {editingId ? 'Salvar Alterações' : 'Confirmar Reserva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}