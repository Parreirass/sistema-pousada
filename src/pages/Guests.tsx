import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, X, Search, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';

type Guest = { 
  id: string; name: string; document: string; email: string; phone: string; profession: string; 
  cep?: string; street?: string; number?: string; complement?: string; 
  neighborhood?: string; city?: string; state?: string; country?: string;
  reservations?: { check_in: string }[] 
};

export function Guests() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const initialForm = { 
    name: '', document: '', email: '', phone: '', profession: '', 
    cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', country: 'Brasil' 
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => { fetchGuests(); }, []);

  async function fetchGuests() {
    setLoading(true);
    const { data } = await supabase.from('guests').select('*, reservations(check_in)').order('name', { ascending: true });
    if (data) setGuests(data as Guest[]);
    setLoading(false);
  }

  function openModal(guest?: Guest) {
    if (guest) {
      setEditingId(guest.id);
      setFormData({ 
        name: guest.name, document: guest.document || '', email: guest.email || '', phone: guest.phone || '', profession: guest.profession || '',
        cep: guest.cep || '', street: guest.street || '', number: guest.number || '', complement: guest.complement || '', 
        neighborhood: guest.neighborhood || '', city: guest.city || '', state: guest.state || '', country: guest.country || 'Brasil'
      });
    } else {
      setEditingId(null);
      setFormData(initialForm);
    }
    setIsModalOpen(true);
  }

  // BUSCA AUTOMÁTICA DE CEP (ViaCEP)
  async function fetchCep(cepValue: string) {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            street: data.logradouro || prev.street,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
            country: 'Brasil'
          }));
        }
      } catch (err) {
        console.error("Erro ao buscar CEP", err);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) await supabase.from('guests').update(formData).eq('id', editingId);
    else await supabase.from('guests').insert([formData]);
    setIsModalOpen(false);
    fetchGuests();
  }

  const filteredGuests = guests.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()) || (g.document && g.document.includes(searchTerm)));

  const getLastHosting = (reservations?: { check_in: string }[]) => {
    if (!reservations || reservations.length === 0) return 'Sem reservas';
    const dates = reservations.map(r => r.check_in).sort((a, b) => b.localeCompare(a));
    return format(parseISO(dates[0]), 'dd/MM/yyyy');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><Users className="text-blue-600"/> Hóspedes</h1>
        </div>
        <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium">
          <Plus size={20} /> Novo Hóspede
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="relative w-full md:w-96 mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={18} className="text-gray-400" /></div>
          <input type="text" placeholder="Pesquisar por nome ou CPF..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm uppercase">
              <tr><th className="p-4">Nome</th><th className="p-4">Doc/Telefone</th><th className="p-4">Cidade/UF</th><th className="p-4">Última Hospedagem</th><th className="p-4 text-right">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {filteredGuests.map(guest => (
                <tr key={guest.id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">{guest.name}<br/><span className="text-xs text-gray-500 font-normal">{guest.email}</span></td>
                  <td className="p-4 text-gray-600">{guest.document || '-'}<br/><span className="text-xs text-gray-500">{guest.phone}</span></td>
                  <td className="p-4 text-gray-600">{guest.city ? `${guest.city}/${guest.state}` : '-'}</td>
                  <td className="p-4 text-gray-600">{getLastHosting(guest.reservations)}</td>
                  <td className="p-4 text-right"><button onClick={() => openModal(guest)} className="text-blue-600 hover:text-blue-800 p-2 rounded-md hover:bg-blue-50"><Edit2 size={18} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl my-8">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Editar Hóspede' : 'Novo Hóspede'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-xs font-medium text-gray-700 mb-1">Nome Completo *</label><input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">CPF/BI</label><input type="text" value={formData.document} onChange={e => setFormData({...formData, document: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Telefone</label><input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Email</label><input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Profissão</label><input type="text" value={formData.profession} onChange={e => setFormData({...formData, profession: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
              </div>

              {/* BLOCO DE ENDEREÇO */}
              <div className="pt-4 mt-2 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Endereço</h3>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">CEP</label>
                    <input type="text" placeholder="00000-000" maxLength={9} value={formData.cep} onChange={e => { setFormData({...formData, cep: e.target.value}); fetchCep(e.target.value); }} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500 bg-blue-50" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">País</label>
                    <input type="text" value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Rua / Avenida</label>
                    <input type="text" value={formData.street} onChange={e => setFormData({...formData, street: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Número</label>
                    <input type="text" value={formData.number} onChange={e => setFormData({...formData, number: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Complemento</label><input type="text" value={formData.complement} onChange={e => setFormData({...formData, complement: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Bairro</label><input type="text" value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-3"><label className="block text-xs font-medium text-gray-700 mb-1">Cidade</label><input type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none" /></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">UF</label><input type="text" maxLength={2} value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none uppercase" /></div>
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Salvar Hóspede</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}