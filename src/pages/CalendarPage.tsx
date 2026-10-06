import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, parseISO, startOfWeek, endOfWeek, isSameMonth, isToday, differenceInDays 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X, AlertCircle, Edit2, Calendar as CalendarIcon, Search, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Room = { id: string; name: string; capacity: number; default_price: number };
type Guest = { 
  id: string; name: string; document: string; email: string; phone: string; profession: string; 
  cep?: string; street?: string; number?: string; complement?: string; neighborhood?: string; city?: string; state?: string; country?: string;
};
type Reservation = {
  id: string; room_id: string; guest_id: string; guest_name: string; guest_count: number;
  check_in: string; check_out: string; daily_rate: number; total_price: number;
  status: string; room: { name: string }; guest?: Guest;
};

type ModalState = {
  isOpen: boolean; mode: 'view' | 'edit' | 'create'; reservation?: Reservation; selectedDate?: string;
};

export function CalendarPage() {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [selectedView, setSelectedView] = useState<string>('general');
  const [loading, setLoading] = useState(true);
  
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'view' });
  const [formError, setFormError] = useState('');

  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [showGuestDropdown, setShowGuestDropdown] = useState(false);
  const [guestCount, setGuestCount] = useState<number | ''>('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [dailyRate, setDailyRate] = useState<number | ''>('');
  const [totalPrice, setTotalPrice] = useState<number | ''>('');
  const [status, setStatus] = useState('confirmed');

  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [newGuest, setNewGuest] = useState({ 
    name: '', document: '', email: '', phone: '', profession: '', 
    cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', country: 'Brasil' 
  });

  const [viewingGuest, setViewingGuest] = useState<Guest | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setShowGuestDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [currentDate]);

  async function fetchData() {
    setLoading(true);
    const { data: roomsData } = await supabase.from('rooms').select('*').eq('status', 'active').order('name');
    if (roomsData) setRooms(roomsData);

    const { data: guestsData } = await supabase.from('guests').select('*').order('name');
    if (guestsData) setGuests(guestsData);

    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

    const { data: resData } = await supabase
      .from('reservations')
      .select('*, room:rooms(name), guest:guests(*)') // Busca completa do hóspede
      .neq('status', 'cancelled')
      .lte('check_in', end)
      .gte('check_out', start);
      
    if (resData) setReservations(resData as unknown as Reservation[]);
    setLoading(false);
  }

  async function fetchCep(cepValue: string) {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setNewGuest(prev => ({
            ...prev, street: data.logradouro || prev.street, neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city, state: data.uf || prev.state, country: 'Brasil'
          }));
        }
      } catch (err) {}
    }
  }

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToday = () => setCurrentDate(new Date());

  function handleDateChange(inDate: string, outDate: string, roomId: string) {
    if (roomId && inDate && outDate && roomId !== 'general') {
      const selectedRoom = rooms.find(r => r.id === roomId);
      if (selectedRoom) {
        setDailyRate(selectedRoom.default_price);
        const days = differenceInDays(parseISO(outDate), parseISO(inDate));
        if (days > 0) setTotalPrice(days * selectedRoom.default_price); else setTotalPrice('');
      }
    }
  }

  const handleDayClick = (dateStr: string) => {
    if (selectedView === 'general') return;
    setFormError(''); setGuestSearch(''); setSelectedGuestId(''); setGuestCount('');
    setCheckIn(dateStr); setCheckOut(''); setDailyRate(''); setTotalPrice(''); setStatus('confirmed');
    setModal({ isOpen: true, mode: 'create', selectedDate: dateStr });
  };

  const handleReservationClick = (e: React.MouseEvent, res: Reservation) => {
    e.stopPropagation(); setFormError(''); setModal({ isOpen: true, mode: 'view', reservation: res });
  };

  const startEditMode = () => {
    if (modal.reservation) {
      const res = modal.reservation;
      setGuestSearch(res.guest?.name || res.guest_name); setSelectedGuestId(res.guest_id || '');
      setGuestCount(res.guest_count); setCheckIn(res.check_in); setCheckOut(res.check_out);
      setDailyRate(res.daily_rate); setTotalPrice(res.total_price); setStatus(res.status);
      setModal({ ...modal, mode: 'edit' });
    }
  };

  async function handleSaveReservation(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (differenceInDays(parseISO(checkOut), parseISO(checkIn)) <= 0) return setFormError("A data de saída deve ser posterior à de entrada.");
    if (!selectedGuestId && !guestSearch) return setFormError("Por favor, selecione ou registe um hóspede.");

    const roomId = selectedView !== 'general' ? selectedView : modal.reservation?.room_id;
    const reservationData = {
      room_id: roomId, guest_id: selectedGuestId || null, guest_name: guestSearch,
      guest_count: Number(guestCount), check_in: checkIn, check_out: checkOut, daily_rate: Number(dailyRate),
      total_price: Number(totalPrice), status, ...(modal.mode === 'create' ? { created_by: profile?.id } : {})
    };

    let errorObj;
    if (modal.mode === 'edit' && modal.reservation) {
      const { error } = await supabase.from('reservations').update(reservationData).eq('id', modal.reservation.id);
      errorObj = error;
    } else {
      const { error } = await supabase.from('reservations').insert([reservationData]);
      errorObj = error;
    }

    if (errorObj) setFormError(errorObj.message); else { setModal({ isOpen: false, mode: 'view' }); fetchData(); }
  }

  async function handleSaveGuest(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.from('guests').insert([newGuest]).select().single();
    if (error) return setFormError(error.message);
    setGuests(prev => [...prev, data]); setSelectedGuestId(data.id); setGuestSearch(data.name);
    setGuestModalOpen(false); setNewGuest({ name: '', document: '', email: '', phone: '', profession: '', cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', country: 'Brasil' });
  }

  const filteredGuests = guests.filter(g => g.name.toLowerCase().includes(guestSearch.toLowerCase()) || (g.document && g.document.includes(guestSearch)));

  const statusColors: Record<string, string> = { reserved: 'bg-yellow-100 border-yellow-300 text-yellow-800', confirmed: 'bg-blue-100 border-blue-300 text-blue-800', hosted: 'bg-green-100 border-green-300 text-green-800', finished: 'bg-gray-200 border-gray-400 text-gray-800' };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-4">
          <div className="bg-black text-white px-4 py-2 rounded-lg font-bold text-xl uppercase tracking-wider">{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <select value={selectedView} onChange={(e) => setSelectedView(e.target.value)} className="w-full sm:w-auto p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium">
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
        <div className="grid grid-cols-7 border-b border-gray-300 bg-gray-50">
          {weekDays.map(day => (<div key={day} className="p-3 text-center font-bold text-sm text-gray-700 border-r border-gray-300 last:border-r-0 uppercase tracking-wider"><span className="hidden md:inline">{day}</span><span className="md:hidden">{day.substring(0, 3)}</span></div>))}
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">A carregar calendário...</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-7 auto-rows-[minmax(120px,auto)] min-h-full">
              {calendarDays.map((day, idx) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isTodayDate = isToday(day);
                const dayReservations = reservations.filter(res => {
                  if (selectedView !== 'general' && res.room_id !== selectedView) return false;
                  return dateStr >= res.check_in && dateStr < res.check_out;
                });

                return (
                  <div key={day.toISOString()} onClick={() => handleDayClick(dateStr)} className={`border-b border-r border-gray-200 last:border-r-0 p-1 flex flex-col ${!isCurrentMonth ? 'bg-gray-50 opacity-50' : 'bg-white'} ${selectedView !== 'general' ? 'cursor-pointer hover:bg-blue-50 transition' : ''} ${(idx + 1) % 7 === 0 ? 'border-r-0' : ''}`}>
                    <div className={`text-right p-1 ${isTodayDate ? 'font-bold text-blue-600' : 'text-gray-600 font-medium'}`}>{format(day, 'd')}</div>
                    <div className="flex-1 overflow-y-auto space-y-1">
                      {dayReservations.map(res => (
                        <div key={res.id} onClick={(e) => handleReservationClick(e, res)} className={`text-xs p-1.5 rounded border cursor-pointer truncate shadow-sm transition-transform hover:scale-[1.02] ${statusColors[res.status] || 'bg-blue-100 border-blue-300'}`} title={`${res.guest?.name || res.guest_name}\n${res.room.name}`}>
                          <span className="font-bold">{selectedView === 'general' ? `${res.room.name}: ` : ''}</span>
                          {res.guest?.name || res.guest_name}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {modal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><CalendarIcon size={20} className="text-blue-600" />{modal.mode === 'view' ? 'Detalhes da Reserva' : modal.mode === 'edit' ? 'Editar Reserva' : 'Nova Reserva'}</h2>
              <button onClick={() => setModal({ isOpen: false, mode: 'view' })} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            {modal.mode === 'view' && modal.reservation && (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Hóspede</p>
                    {/* PONTO 1: NOME CLICÁVEL NO MODAL DO CALENDÁRIO */}
                    <button 
                      onClick={() => modal.reservation?.guest && setViewingGuest(modal.reservation.guest)}
                      className={`font-bold text-lg text-left transition-colors ${modal.reservation.guest ? 'text-blue-600 hover:text-blue-800 hover:underline' : 'text-gray-900'}`}
                    >
                      {modal.reservation.guest?.name || modal.reservation.guest_name}
                    </button>
                  </div>
                  <div><p className="text-sm text-gray-500">Quarto</p><p className="font-bold text-lg">{modal.reservation.room.name}</p></div>
                  <div><p className="text-sm text-gray-500">Check-in</p><p className="font-medium">{format(parseISO(modal.reservation.check_in), 'dd/MM/yyyy')}</p></div>
                  <div><p className="text-sm text-gray-500">Check-out</p><p className="font-medium">{format(parseISO(modal.reservation.check_out), 'dd/MM/yyyy')}</p></div>
                  <div><p className="text-sm text-gray-500">Qtd. Hóspedes</p><p className="font-medium">{modal.reservation.guest_count} pessoas</p></div>
                  <div><p className="text-sm text-gray-500">Valor Total</p><p className="font-bold text-blue-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(modal.reservation.total_price)}</p></div>
                </div>

                <div className="pt-6 border-t flex justify-end gap-3">
                  {selectedView !== 'general' && (
                    <button onClick={startEditMode} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-blue-700"><Edit2 size={18} /> Editar Reserva</button>
                  )}
                  <button onClick={() => setModal({ isOpen: false, mode: 'view' })} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Fechar</button>
                </div>
              </div>
            )}

            {(modal.mode === 'create' || modal.mode === 'edit') && (
              <form onSubmit={handleSaveReservation} className="p-6 space-y-4">
                {formError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 font-medium"><AlertCircle size={18} /> {formError}</div>}
                
                <div className="relative" ref={searchRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pesquisar Hóspede *</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={16} className="text-gray-400" /></div>
                      <input type="text" placeholder="Nome ou Documento..." value={guestSearch} onChange={(e) => { setGuestSearch(e.target.value); setSelectedGuestId(''); setShowGuestDropdown(true); }} onFocus={() => setShowGuestDropdown(true)} className="w-full pl-10 p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500" />
                      {showGuestDropdown && guestSearch && !selectedGuestId && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {filteredGuests.length > 0 ? filteredGuests.map(g => (
                            <div key={g.id} onClick={() => { setSelectedGuestId(g.id); setGuestSearch(g.name); setShowGuestDropdown(false); }} className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0 border-gray-100">
                              <div className="font-medium text-gray-900">{g.name}</div><div className="text-xs text-gray-500">Doc: {g.document || 'N/A'}</div>
                            </div>
                          )) : <div className="p-3 text-sm text-gray-500">Nenhum hóspede encontrado.</div>}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => setGuestModalOpen(true)} className="bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition"><UserPlus size={16} /> <span className="hidden sm:inline">Registar Hóspede</span></button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Entrada *</label><input type="date" required value={checkIn} onChange={(e) => { setCheckIn(e.target.value); handleDateChange(e.target.value, checkOut, selectedView); }} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Saída *</label><input type="date" required value={checkOut} onChange={(e) => { setCheckOut(e.target.value); handleDateChange(checkIn, e.target.value, selectedView); }} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Qtd. Hóspedes *</label><input type="number" required min="1" value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label><select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg outline-none"><option value="confirmed">Confirmada</option><option value="cancelled">Cancelada</option></select></div>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg flex justify-between items-center border border-blue-100">
                  <span className="text-blue-800 font-medium">Valor Total:</span><input type="number" step="0.01" required value={totalPrice} onChange={(e) => setTotalPrice(Number(e.target.value))} className="w-24 p-1 border border-blue-300 rounded text-right font-bold text-blue-700 outline-none" />
                </div>

                <div className="pt-4 border-t flex justify-end gap-3">
                  <button type="button" onClick={() => modal.mode === 'edit' ? setModal({...modal, mode: 'view'}) : setModal({isOpen: false, mode: 'view'})} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm">{modal.mode === 'create' ? 'Confirmar Reserva' : 'Guardar Alterações'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* PONTO 3: MODAL DE NOVO HÓSPEDE CORRIGIDO (COM CEP) */}
      {guestModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl my-8">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50"><h2 className="text-lg font-bold text-gray-900">Novo Registo de Hóspede</h2><button onClick={() => setGuestModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div>
            <form onSubmit={handleSaveGuest} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-xs font-medium text-gray-700 mb-1">Nome Completo *</label><input type="text" required value={newGuest.name} onChange={e => setNewGuest({...newGuest, name: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">CPF/BI</label><input type="text" value={newGuest.document} onChange={e => setNewGuest({...newGuest, document: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Telefone</label><input type="text" value={newGuest.phone} onChange={e => setNewGuest({...newGuest, phone: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Email</label><input type="email" value={newGuest.email} onChange={e => setNewGuest({...newGuest, email: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Profissão</label><input type="text" value={newGuest.profession} onChange={e => setNewGuest({...newGuest, profession: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
              </div>

              <div className="pt-4 mt-2 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Endereço</h3>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">CEP</label><input type="text" placeholder="00000-000" maxLength={9} value={newGuest.cep} onChange={e => { setNewGuest({...newGuest, cep: e.target.value}); fetchCep(e.target.value); }} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500 bg-blue-50" /></div>
                  <div className="col-span-2"><label className="block text-xs font-medium text-gray-700 mb-1">País</label><input type="text" value={newGuest.country} onChange={e => setNewGuest({...newGuest, country: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div className="col-span-3"><label className="block text-xs font-medium text-gray-700 mb-1">Rua / Avenida</label><input type="text" value={newGuest.street} onChange={e => setNewGuest({...newGuest, street: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Número</label><input type="text" value={newGuest.number} onChange={e => setNewGuest({...newGuest, number: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Complemento</label><input type="text" value={newGuest.complement} onChange={e => setNewGuest({...newGuest, complement: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Bairro</label><input type="text" value={newGuest.neighborhood} onChange={e => setNewGuest({...newGuest, neighborhood: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-3"><label className="block text-xs font-medium text-gray-700 mb-1">Cidade</label><input type="text" value={newGuest.city} onChange={e => setNewGuest({...newGuest, city: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">UF</label><input type="text" maxLength={2} value={newGuest.state} onChange={e => setNewGuest({...newGuest, state: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none uppercase" /></div>
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3"><button type="button" onClick={() => setGuestModalOpen(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium">Cancelar</button><button type="submit" className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium">Guardar Hóspede</button></div>
            </form>
          </div>
        </div>
      )}

      {/* PONTO 1: MODAL DE VISUALIZAÇÃO DOS DADOS DO HÓSPEDE */}
      {viewingGuest && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">Ficha do Hóspede</h2>
              <button onClick={() => setViewingGuest(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div><p className="text-gray-500 font-medium text-xs uppercase tracking-wider mb-1">Nome Completo</p><p className="font-bold text-lg text-gray-900">{viewingGuest.name}</p></div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-gray-500 font-medium text-xs uppercase tracking-wider mb-1">Doc (CPF/BI)</p><p className="text-gray-900">{viewingGuest.document || '-'}</p></div>
                <div><p className="text-gray-500 font-medium text-xs uppercase tracking-wider mb-1">Telefone</p><p className="text-gray-900">{viewingGuest.phone || '-'}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-gray-500 font-medium text-xs uppercase tracking-wider mb-1">Email</p><p className="text-gray-900 truncate" title={viewingGuest.email}>{viewingGuest.email || '-'}</p></div>
                <div><p className="text-gray-500 font-medium text-xs uppercase tracking-wider mb-1">Profissão</p><p className="text-gray-900">{viewingGuest.profession || '-'}</p></div>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <p className="text-gray-500 font-medium text-xs uppercase tracking-wider mb-2">Endereço</p>
                <p className="text-gray-900 leading-relaxed">
                  {viewingGuest.street ? (
                    <>{viewingGuest.street}, {viewingGuest.number} {viewingGuest.complement ? `(${viewingGuest.complement})` : ''} - {viewingGuest.neighborhood}<br/>{viewingGuest.city}/{viewingGuest.state} - {viewingGuest.country}<br/>CEP: {viewingGuest.cep}</>
                  ) : <span className="text-gray-400 italic">Endereço não cadastrado.</span>}
                </p>
              </div>
              <div className="pt-4 text-right"><button onClick={() => setViewingGuest(null)} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Fechar Ficha</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}