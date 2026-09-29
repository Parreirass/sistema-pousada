import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, parseISO, startOfWeek, endOfWeek, isSameMonth, isToday, differenceInDays 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X, AlertCircle, Edit2, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Room = { id: string; name: string; capacity: number; default_price: number };
type Reservation = {
  id: string; room_id: string; guest_name: string; guest_count: number;
  check_in: string; check_out: string; daily_rate: number; total_price: number;
  status: string; room: { name: string };
};

type ModalState = {
  isOpen: boolean;
  mode: 'view' | 'edit' | 'create';
  reservation?: Reservation;
  selectedDate?: string;
};

export function CalendarPage() {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedView, setSelectedView] = useState<string>('general'); // 'general' ou room.id
  const [loading, setLoading] = useState(true);
  
  // Estado do Modal Unificado
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'view' });
  const [formError, setFormError] = useState('');

  // Estados do Formulário (Para Create/Edit)
  const [guestName, setGuestName] = useState('');
  const [guestCount, setGuestCount] = useState<number | ''>('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [dailyRate, setDailyRate] = useState<number | ''>('');
  const [totalPrice, setTotalPrice] = useState<number | ''>('');
  const [status, setStatus] = useState('confirmed');

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  async function fetchData() {
    setLoading(true);
    const { data: roomsData } = await supabase.from('rooms').select('*').eq('status', 'active').order('name');
    if (roomsData) setRooms(roomsData);

    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

    const { data: resData } = await supabase
      .from('reservations')
      .select('*, room:rooms(name)')
      .neq('status', 'cancelled')
      .lte('check_in', end)
      .gte('check_out', start);
      
    if (resData) setReservations(resData as unknown as Reservation[]);
    setLoading(false);
  }

  // Cálculos do Calendário (Grade completa de Domingo a Sábado)
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // 0 = Domingo
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  // Ações de Navegação
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToday = () => setCurrentDate(new Date());

  // Lógica do Formulário (Preços Automáticos)
  function handleDateChange(inDate: string, outDate: string, roomId: string) {
    if (roomId && inDate && outDate) {
      const selectedRoom = rooms.find(r => r.id === roomId);
      if (selectedRoom) {
        setDailyRate(selectedRoom.default_price);
        const days = differenceInDays(parseISO(outDate), parseISO(inDate));
        if (days > 0) setTotalPrice(days * selectedRoom.default_price);
        else setTotalPrice('');
      }
    }
  }

  // Abertura de Modais
  const handleDayClick = (dateStr: string) => {
    if (selectedView === 'general') return; // Geral não cria reserva clicando no calendário

    setFormError('');
    setGuestName(''); setGuestCount('');
    setCheckIn(dateStr); setCheckOut(''); 
    setDailyRate(''); setTotalPrice(''); setStatus('confirmed');
    setModal({ isOpen: true, mode: 'create', selectedDate: dateStr });
  };

  const handleReservationClick = (e: React.MouseEvent, res: Reservation) => {
    e.stopPropagation(); // Impede de disparar o clique do dia no fundo
    setFormError('');
    setModal({ isOpen: true, mode: 'view', reservation: res });
  };

  const startEditMode = () => {
    if (modal.reservation) {
      const res = modal.reservation;
      setGuestName(res.guest_name);
      setGuestCount(res.guest_count);
      setCheckIn(res.check_in);
      setCheckOut(res.check_out);
      setDailyRate(res.daily_rate);
      setTotalPrice(res.total_price);
      setStatus(res.status);
      setModal({ ...modal, mode: 'edit' });
    }
  };

  // Salvar Reserva
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (differenceInDays(parseISO(checkOut), parseISO(checkIn)) <= 0) {
      setFormError("A data de saída deve ser depois da entrada.");
      return;
    }

    const roomId = selectedView !== 'general' ? selectedView : modal.reservation?.room_id;
    
    const reservationData = {
      room_id: roomId, guest_name: guestName, guest_count: Number(guestCount),
      check_in: checkIn, check_out: checkOut, daily_rate: Number(dailyRate),
      total_price: Number(totalPrice), status,
      ...(modal.mode === 'create' ? { created_by: profile?.id } : {})
    };

    let errorObj;
    if (modal.mode === 'edit' && modal.reservation) {
      const { error } = await supabase.from('reservations').update(reservationData).eq('id', modal.reservation.id);
      errorObj = error;
    } else {
      const { error } = await supabase.from('reservations').insert([reservationData]);
      errorObj = error;
    }

    if (errorObj) {
      setFormError(errorObj.message);
    } else {
      setModal({ isOpen: false, mode: 'view' });
      fetchData();
    }
  }

  // Cores de status
  const statusColors: Record<string, string> = {
    reserved: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    confirmed: 'bg-blue-100 border-blue-300 text-blue-800',
    hosted: 'bg-green-100 border-green-300 text-green-800',
    finished: 'bg-gray-200 border-gray-400 text-gray-800',
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-4">
          <div className="bg-black text-white px-4 py-2 rounded-lg font-bold text-xl uppercase tracking-wider">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <select 
            value={selectedView} 
            onChange={(e) => setSelectedView(e.target.value)}
            className="w-full sm:w-auto p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="general">Visão Geral (Todos os Quartos)</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200 w-full sm:w-auto justify-center">
            <button onClick={prevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-md transition"><ChevronLeft size={20} /></button>
            <button onClick={goToday} className="px-4 py-2 font-medium text-sm hover:bg-white hover:shadow-sm rounded-md transition">Hoje</button>
            <button onClick={nextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-md transition"><ChevronRight size={20} /></button>
          </div>
        </div>
      </div>

      {/* Grade do Calendário */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden flex flex-col">
        {/* Cabeçalho dos Dias (Dom a Sáb) */}
        <div className="grid grid-cols-7 border-b border-gray-300 bg-gray-50">
          {weekDays.map(day => (
            <div key={day} className="p-3 text-center font-bold text-sm text-gray-700 border-r border-gray-300 last:border-r-0 uppercase tracking-wider">
              <span className="hidden md:inline">{day}</span>
              <span className="md:hidden">{day.substring(0, 3)}</span>
            </div>
          ))}
        </div>

        {/* Células dos Dias */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">Carregando calendário...</div>
        ) : (
          <div className="flex-1 grid grid-cols-7 grid-rows-5 md:grid-rows-auto">
            {calendarDays.map((day, idx) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isTodayDate = isToday(day);

              // Filtra reservas que sobrepõem este dia
              const dayReservations = reservations.filter(res => {
                if (selectedView !== 'general' && res.room_id !== selectedView) return false;
                return dateStr >= res.check_in && dateStr < res.check_out;
              });

              return (
                <div 
                  key={day.toISOString()} 
                  onClick={() => handleDayClick(dateStr)}
                  className={`min-h-[100px] border-b border-r border-gray-200 last:border-r-0 p-1 flex flex-col 
                    ${!isCurrentMonth ? 'bg-gray-50 opacity-50' : 'bg-white'} 
                    ${selectedView !== 'general' ? 'cursor-pointer hover:bg-blue-50 transition' : ''}
                    ${(idx + 1) % 7 === 0 ? 'border-r-0' : ''}
                  `}
                >
                  <div className={`text-right p-1 ${isTodayDate ? 'font-bold text-blue-600' : 'text-gray-600 font-medium'}`}>
                    {format(day, 'd')}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-1">
                    {dayReservations.map(res => (
                      <div 
                        key={res.id} 
                        onClick={(e) => handleReservationClick(e, res)}
                        className={`text-xs p-1.5 rounded border cursor-pointer truncate shadow-sm transition-transform hover:scale-[1.02] ${statusColors[res.status] || 'bg-blue-100 border-blue-300'}`}
                        title={`${res.guest_name}\n${res.room.name}`}
                      >
                        <span className="font-bold">
                          {selectedView === 'general' ? `${res.room.name}: ` : ''}
                        </span>
                        {res.guest_name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL UNIFICADO (VIEW / CREATE / EDIT) */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <CalendarIcon size={20} className="text-blue-600" />
                {modal.mode === 'view' ? 'Detalhes da Reserva' : modal.mode === 'edit' ? 'Editar Reserva' : 'Nova Reserva'}
              </h2>
              <button onClick={() => setModal({ isOpen: false, mode: 'view' })} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            {/* MODO VISUALIZAÇÃO */}
            {modal.mode === 'view' && modal.reservation && (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-gray-500">Hóspede</p><p className="font-bold text-lg">{modal.reservation.guest_name}</p></div>
                  <div><p className="text-sm text-gray-500">Quarto</p><p className="font-bold text-lg">{modal.reservation.room.name}</p></div>
                  <div><p className="text-sm text-gray-500">Check-in</p><p className="font-medium">{format(parseISO(modal.reservation.check_in), 'dd/MM/yyyy')}</p></div>
                  <div><p className="text-sm text-gray-500">Check-out</p><p className="font-medium">{format(parseISO(modal.reservation.check_out), 'dd/MM/yyyy')}</p></div>
                  <div><p className="text-sm text-gray-500">Qtd. Hóspedes</p><p className="font-medium">{modal.reservation.guest_count} pessoas</p></div>
                  <div><p className="text-sm text-gray-500">Valor Total</p><p className="font-bold text-blue-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(modal.reservation.total_price)}</p></div>
                </div>

                <div className="pt-6 border-t flex justify-end gap-3">
                  {selectedView !== 'general' && (
                    <button onClick={startEditMode} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-blue-700">
                      <Edit2 size={18} /> Editar Reserva
                    </button>
                  )}
                  <button onClick={() => setModal({ isOpen: false, mode: 'view' })} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                    Fechar
                  </button>
                </div>
              </div>
            )}

            {/* MODO FORMULÁRIO (CREATE / EDIT) */}
            {(modal.mode === 'create' || modal.mode === 'edit') && (
              <form onSubmit={handleSave} className="p-6 space-y-4">
                {formError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 font-medium">
                    <AlertCircle size={18} /> {formError}
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hóspede *</label>
                  <input type="text" required value={guestName} onChange={(e) => setGuestName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Entrada *</label>
                    <input type="date" required value={checkIn} onChange={(e) => { setCheckIn(e.target.value); handleDateChange(e.target.value, checkOut, selectedView); }} className="w-full p-2 border border-gray-300 rounded-lg outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Saída *</label>
                    <input type="date" required value={checkOut} onChange={(e) => { setCheckOut(e.target.value); handleDateChange(checkIn, e.target.value, selectedView); }} className="w-full p-2 border border-gray-300 rounded-lg outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hóspedes *</label>
                    <input type="number" required min="1" value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-lg outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg outline-none">
                      <option value="confirmed">Confirmada</option>
                      <option value="cancelled">Cancelada</option>
                    </select>
                  </div>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg flex justify-between items-center border border-blue-100">
                  <span className="text-blue-800 font-medium">Valor Total:</span>
                  <input type="number" step="0.01" required value={totalPrice} onChange={(e) => setTotalPrice(Number(e.target.value))} className="w-24 p-1 border border-blue-300 rounded text-right font-bold text-blue-700 outline-none" />
                </div>

                <div className="pt-4 border-t flex justify-end gap-3">
                  <button type="button" onClick={() => modal.mode === 'edit' ? setModal({...modal, mode: 'view'}) : setModal({isOpen: false, mode: 'view'})} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium">
                    Cancelar
                  </button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm">
                    {modal.mode === 'create' ? 'Confirmar Reserva' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}