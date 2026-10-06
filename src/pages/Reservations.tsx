import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, X, AlertCircle, Search, UserPlus } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

type Room = { id: string; name: string; capacity: number; default_price: number };
type Guest = { 
  id: string; name: string; document: string; email: string; phone: string; profession: string; 
  cep?: string; street?: string; number?: string; complement?: string; neighborhood?: string; city?: string; state?: string; country?: string;
};
type Reservation = {
  id: string; room_id: string; guest_id: string; guest_name: string; guest_count: number;
  check_in: string; check_out: string; daily_rate: number; total_price: number;
  status: 'reserved' | 'confirmed' | 'hosted' | 'finished' | 'cancelled';
  room: { name: string }; guest?: Guest;
};

export function Reservations() {
  const { profile } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState('');

  // Estados do formulário de Reserva
  const [editingId, setEditingId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState('');
  
  // Estados do Hóspede (Pesquisa inteligente)
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [showGuestDropdown, setShowGuestDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  // Estados do Novo Hóspede
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [newGuest, setNewGuest] = useState({ 
    name: '', document: '', email: '', phone: '', profession: '', 
    cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', country: 'Brasil' 
  });

  // Estado para Visualizar Dados do Hóspede (Ponto 1)
  const [viewingGuest, setViewingGuest] = useState<Guest | null>(null);

  const [guestCount, setGuestCount] = useState<number | ''>('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [dailyRate, setDailyRate] = useState<number | ''>('');
  const [totalPrice, setTotalPrice] = useState<number | ''>('');
  const [status, setStatus] = useState<Reservation['status']>('confirmed');

  useEffect(() => {
    fetchData();
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setShowGuestDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: roomsData } = await supabase.from('rooms').select('*').eq('status', 'active');
    if (roomsData) setRooms(roomsData);

    const { data: guestsData } = await supabase.from('guests').select('*').order('name');
    if (guestsData) setGuests(guestsData);

    const { data: resData } = await supabase
      .from('reservations')
      .select('*, room:rooms(name), guest:guests(*)') // Trazemos TODOS os dados do hóspede
      .order('check_in', { ascending: true });
    
    if (resData) setReservations(resData as unknown as Reservation[]);
    setLoading(false);
  }

  // Busca de CEP para o modal rápido
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

  function handleDateOrRoomChange(rId: string, inDate: string, outDate: string) {
    if (rId && inDate && outDate) {
      const selectedRoom = rooms.find(r => r.id === rId);
      if (selectedRoom) {
        setDailyRate(selectedRoom.default_price);
        const days = differenceInDays(parseISO(outDate), parseISO(inDate));
        if (days > 0) setTotalPrice(days * selectedRoom.default_price);
        else setTotalPrice('');
      }
    }
  }

  function openModal(res?: Reservation) {
    setError('');
    if (res) {
      setEditingId(res.id); setRoomId(res.room_id); setSelectedGuestId(res.guest_id || '');
      setGuestSearch(res.guest?.name || res.guest_name); setGuestCount(res.guest_count);
      setCheckIn(res.check_in); setCheckOut(res.check_out); setDailyRate(res.daily_rate); 
      setTotalPrice(res.total_price); setStatus(res.status);
    } else {
      setEditingId(null); setRoomId(''); setSelectedGuestId(''); setGuestSearch(''); setGuestCount('');
      setCheckIn(''); setCheckOut(''); setDailyRate(''); setTotalPrice(''); setStatus('confirmed');
    }
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (differenceInDays(parseISO(checkOut), parseISO(checkIn)) <= 0) return setError("A data de saída deve ser depois da entrada.");
    if (!selectedGuestId && !guestSearch) return setError("Por favor, selecione ou registe um hóspede.");

    const reservationData = {
      room_id: roomId, guest_id: selectedGuestId || null, guest_name: guestSearch,
      guest_count: Number(guestCount), check_in: checkIn, check_out: checkOut,
      daily_rate: Number(dailyRate), total_price: Number(totalPrice), status,
      ...(editingId ? {} : { created_by: profile?.id })
    };

    if (editingId) {
      const { error: updateError } = await supabase.from('reservations').update(reservationData).eq('id', editingId);
      if (updateError) setError(updateError.message); else { setIsModalOpen(false); fetchData(); }
    } else {
      const { error: insertError } = await supabase.from('reservations').insert([reservationData]);
      if (insertError) setError(insertError.message); else { setIsModalOpen(false); fetchData(); }
    }
  }

  async function handleSaveGuest(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.from('guests').insert([newGuest]).select().single();
    if (error) { setError(error.message); return; }
    setGuests(prev => [...prev, data]);
    setSelectedGuestId(data.id); setGuestSearch(data.name);
    setGuestModalOpen(false); setNewGuest({ name: '', document: '', email: '', phone: '', profession: '', cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', country: 'Brasil' });
  }

  const filteredGuests = guests.filter(g => g.name.toLowerCase().includes(guestSearch.toLowerCase()) || (g.document && g.document.includes(guestSearch)));

  const statusColors = { reserved: 'bg-yellow-100 text-yellow-800', confirmed: 'bg-blue-100 text-blue-800', hosted: 'bg-green-100 text-green-800', finished: 'bg-gray-100 text-gray-800', cancelled: 'bg-red-100 text-red-800 line-through' };
  const statusLabels = { reserved: 'Reservada', confirmed: 'Confirmada', hosted: 'Hospedado', finished: 'Finalizada', cancelled: 'Cancelada' };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Reservas</h1>
        <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium"><Plus size={20} /> Nova Reserva</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm uppercase">
              <th className="p-4 font-medium">Hóspede</th><th className="p-4 font-medium">Quarto</th><th className="p-4 font-medium">Período</th><th className="p-4 font-medium">Valor Total</th><th className="p-4 font-medium">Status</th><th className="p-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? <tr><td colSpan={6} className="p-8 text-center text-gray-500">A carregar...</td></tr> : 
             reservations.map((res) => (
              <tr key={res.id} className="hover:bg-gray-50">
                <td className="p-4">
                  {/* PONTO 1: Nome Clicável para abrir o modal de detalhes */}
                  <button 
                    onClick={() => res.guest && setViewingGuest(res.guest)}
                    className={`font-semibold text-left transition-colors ${res.guest ? 'text-blue-600 hover:text-blue-800 hover:underline' : 'text-gray-900'}`}
                    title={res.guest ? 'Ver ficha do hóspede' : 'Cadastro antigo (sem ficha)'}
                  >
                    {res.guest?.name || res.guest_name}
                  </button>
                </td>
                <td className="p-4 text-gray-700">{res.room.name}</td>
                <td className="p-4 text-gray-700">{new Date(res.check_in).toLocaleDateString('pt-BR', {timeZone:'UTC'})} até {new Date(res.check_out).toLocaleDateString('pt-BR', {timeZone:'UTC'})}</td>
                <td className="p-4 text-gray-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res.total_price)}</td>
                <td className="p-4"><span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[res.status]}`}>{statusLabels[res.status]}</span></td>
                <td className="p-4 text-right"><button onClick={() => openModal(res)} className="text-blue-600 hover:text-blue-800 p-2 rounded-md hover:bg-blue-50"><Edit2 size={18} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL RESERVA */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex justify-between items-center p-6 border-b border-gray-100"><h2 className="text-xl font-bold text-gray-900">{editingId ? 'Editar Reserva' : 'Nova Reserva'}</h2><button onClick={() => setIsModalOpen(false)}><X size={24} /></button></div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm flex items-center gap-2"><AlertCircle size={20} /> <span>{error}</span></div>}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="relative" ref={searchRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pesquisar Hóspede *</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={16} className="text-gray-400" /></div>
                      <input type="text" placeholder="Nome ou Documento..." value={guestSearch} onChange={(e) => { setGuestSearch(e.target.value); setSelectedGuestId(''); setShowGuestDropdown(true); }} onFocus={() => setShowGuestDropdown(true)} className="w-full pl-10 p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500" />
                      {showGuestDropdown && guestSearch && !selectedGuestId && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {filteredGuests.map(g => (
                            <div key={g.id} onClick={() => { setSelectedGuestId(g.id); setGuestSearch(g.name); setShowGuestDropdown(false); }} className="p-3 hover:bg-blue-50 cursor-pointer border-b text-sm"><div className="font-medium">{g.name}</div><div className="text-xs text-gray-500">Doc: {g.document || 'N/A'}</div></div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => setGuestModalOpen(true)} className="bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm"><UserPlus size={16} /><span className="hidden sm:inline">Registar</span></button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status da Reserva</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500">
                    <option value="reserved">Reservada (Aguardando Sinal)</option><option value="confirmed">Confirmada</option><option value="hosted">Hóspede na Pousada</option><option value="finished">Finalizada</option><option value="cancelled">Cancelada</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-3 sm:col-span-1"><label className="block text-sm font-medium text-gray-700 mb-1">Quarto *</label><select required value={roomId} onChange={(e) => { setRoomId(e.target.value); handleDateOrRoomChange(e.target.value, checkIn, checkOut); }} className="w-full p-2 border border-gray-300 rounded-lg outline-none"><option value="">Selecione...</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                <div className="col-span-3 sm:col-span-1"><label className="block text-sm font-medium text-gray-700 mb-1">Entrada *</label><input type="date" required value={checkIn} onChange={(e) => { setCheckIn(e.target.value); handleDateOrRoomChange(roomId, e.target.value, checkOut); }} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                <div className="col-span-3 sm:col-span-1"><label className="block text-sm font-medium text-gray-700 mb-1">Saída *</label><input type="date" required value={checkOut} onChange={(e) => { setCheckOut(e.target.value); handleDateOrRoomChange(roomId, checkIn, e.target.value); }} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
              </div>

              <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Qtd Hóspedes *</label><input type="number" required min="1" value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div></div>
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Valor da Diária (R$)</label><input type="number" step="0.01" required value={dailyRate} onChange={(e) => setDailyRate(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Valor Total (R$) *</label><input type="number" step="0.01" required value={totalPrice} onChange={(e) => setTotalPrice(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-lg outline-none font-bold text-blue-700" /></div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">{editingId ? 'Salvar Alterações' : 'Confirmar Reserva'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* PONTO 3: MODAL DE NOVO HÓSPEDE CORRIGIDO E COMPLETO */}
      {guestModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl my-8">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">Novo Registo de Hóspede</h2>
              <button onClick={() => setGuestModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveGuest} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nome Completo *</label>
                  <input type="text" required value={newGuest.name} onChange={e => setNewGuest({...newGuest, name: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">CPF/BI</label>
                  <input type="text" value={newGuest.document} onChange={e => setNewGuest({...newGuest, document: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Telefone</label>
                  <input type="text" value={newGuest.phone} onChange={e => setNewGuest({...newGuest, phone: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={newGuest.email} onChange={e => setNewGuest({...newGuest, email: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Profissão</label>
                  <input type="text" value={newGuest.profession} onChange={e => setNewGuest({...newGuest, profession: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" />
                </div>
              </div>

              {/* BLOCO DE ENDEREÇO COM BUSCA DE CEP */}
              <div className="pt-4 mt-2 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Endereço</h3>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">CEP</label>
                    <input type="text" placeholder="00000-000" maxLength={9} value={newGuest.cep} onChange={e => { setNewGuest({...newGuest, cep: e.target.value}); fetchCep(e.target.value); }} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500 bg-blue-50" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">País</label>
                    <input type="text" value={newGuest.country} onChange={e => setNewGuest({...newGuest, country: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Rua / Avenida</label>
                    <input type="text" value={newGuest.street} onChange={e => setNewGuest({...newGuest, street: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Número</label>
                    <input type="text" value={newGuest.number} onChange={e => setNewGuest({...newGuest, number: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" />
                  </div>
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

              <div className="pt-4 border-t flex justify-end gap-3">
                <button type="button" onClick={() => setGuestModalOpen(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium">Guardar Hóspede</button>
              </div>
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
              <div>
                <p className="text-gray-500 font-medium text-xs uppercase tracking-wider mb-1">Nome Completo</p>
                <p className="font-bold text-lg text-gray-900">{viewingGuest.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 font-medium text-xs uppercase tracking-wider mb-1">Doc (CPF/BI)</p>
                  <p className="text-gray-900">{viewingGuest.document || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium text-xs uppercase tracking-wider mb-1">Telefone</p>
                  <p className="text-gray-900">{viewingGuest.phone || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 font-medium text-xs uppercase tracking-wider mb-1">Email</p>
                  <p className="text-gray-900 truncate" title={viewingGuest.email}>{viewingGuest.email || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium text-xs uppercase tracking-wider mb-1">Profissão</p>
                  <p className="text-gray-900">{viewingGuest.profession || '-'}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <p className="text-gray-500 font-medium text-xs uppercase tracking-wider mb-2">Endereço</p>
                <p className="text-gray-900 leading-relaxed">
                  {viewingGuest.street ? (
                    <>
                      {viewingGuest.street}, {viewingGuest.number} {viewingGuest.complement ? `(${viewingGuest.complement})` : ''} - {viewingGuest.neighborhood}<br/>
                      {viewingGuest.city}/{viewingGuest.state} - {viewingGuest.country}<br/>
                      CEP: {viewingGuest.cep}
                    </>
                  ) : (
                    <span className="text-gray-400 italic">Endereço não cadastrado.</span>
                  )}
                </p>
              </div>
              <div className="pt-4 text-right">
                <button onClick={() => setViewingGuest(null)} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Fechar Ficha</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}