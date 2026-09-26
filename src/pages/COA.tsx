import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit2, 
  Trash2, 
  FileSpreadsheet,
  ArrowUpDown,
  RefreshCw
} from 'lucide-react';
import { subscribeToCollection, addDocument, updateDocument, deleteDocument } from '../services/db';
import { useAuth } from '../lib/AuthContext';
import { COA, AccountCategory, NormalBalance, JournalStatus } from '../types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function COAPage() {
  const [coas, setCoas] = useState<COA[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCoa, setEditingCoa] = useState<COA | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const { user } = useAuth();

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: AccountCategory.ASSET,
    normalBalance: NormalBalance.DEBIT,
    description: '',
    parentId: 'none'
  });

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToCollection<COA>('coa', (data) => {
      setCoas(data.sort((a, b) => a.code.localeCompare(b.code)));
      setLoading(false);
    }, user.uid);
    return unsubscribe;
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        parentId: formData.parentId === 'none' ? null : formData.parentId
      };

      if (editingCoa) {
        await updateDocument('coa', editingCoa.id!, submitData);
        toast.success("Account modified successfully");
      } else {
        await addDocument('coa', submitData);
        toast.success("New account registered to master");
      }
      setIsAddOpen(false);
      setEditingCoa(null);
      resetForm();
    } catch (error) {
      toast.error("Operation failed");
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      category: AccountCategory.ASSET,
      normalBalance: NormalBalance.DEBIT,
      description: '',
      parentId: 'none'
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to terminate this account? This action is irreversible.")) {
      await deleteDocument('coa', id);
      toast.success("Account purged");
    }
  };

  const seedPSAKAccounts = async () => {
    if (!user) return;
    if (coas.length > 0 && !confirm("Daftar Bagan Akun (COA) Anda tidak kosong. Proses ini akan menambahkan data bagan akun standar PSAK Indonesia ke dalam daftar yang sudah ada. Lanjutkan?")) return;

    setIsSeeding(true);
    toast.info("Memulai pembuatan bagan akun standar PSAK Indonesia...");

    try {
      const standardAccounts = [
        // ASET
        { code: '10000', name: 'ASET', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, description: 'Klasifikasi utama seluruh kekayaan perusahaan' },
        { code: '11000', name: 'ASET LANCAR', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '10000', description: 'Sumber daya yang mudah dicairkan kurang dari satu tahun' },
        { code: '11100', name: 'Kas & Setara Kas', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '11000', description: 'Uang tunai dan rekening bank utama' },
        { code: '11101', name: 'Kas Kecil (Petty Cash)', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '11100' },
        { code: '11102', name: 'Bank BCA', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '11100' },
        { code: '11103', name: 'Bank Mandiri', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '11100' },
        { code: '11200', name: 'Piutang Usaha', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '11000', description: 'Tagihan penjualan kredit' },
        { code: '11201', name: 'Penyisihan Piutang Ragu-Ragu', category: AccountCategory.ASSET, normalBalance: NormalBalance.CREDIT, parentCode: '11200', description: 'Kontra-akun untuk estimasi piutang tak tertagih' },
        { code: '11300', name: 'Persediaan', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '11000' },
        { code: '11301', name: 'Persediaan Barang Dagang', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '11300' },
        { code: '11302', name: 'Perlengkapan Kantor', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '11300' },
        { code: '11400', name: 'Biaya Dibayar di Muka', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '11000' },
        { code: '11401', name: 'Sewa Dibayar di Muka', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '11400' },
        { code: '11402', name: 'Asuransi Dibayar di Muka', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '11400' },
        { code: '12000', name: 'ASET TETAP', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '10000', description: 'Kekayaan fisik berwujud berumur lebih dari satu tahun' },
        { code: '12100', name: 'Tanah', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '12000' },
        { code: '12200', name: 'Bangunan', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '12000' },
        { code: '12201', name: 'Akumulasi Penyusutan Bangunan', category: AccountCategory.ASSET, normalBalance: NormalBalance.CREDIT, parentCode: '12200' },
        { code: '12300', name: 'Kendaraan', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '12000' },
        { code: '12301', name: 'Akumulasi Penyusutan Kendaraan', category: AccountCategory.ASSET, normalBalance: NormalBalance.CREDIT, parentCode: '12300' },
        { code: '12400', name: 'Peralatan Kantor & IT', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '12000' },
        { code: '12401', name: 'Akumulasi Penyusutan Peralatan', category: AccountCategory.ASSET, normalBalance: NormalBalance.CREDIT, parentCode: '12400' },

        // LIABILITAS
        { code: '20000', name: 'LIABILITAS', category: AccountCategory.LIABILITY, normalBalance: NormalBalance.CREDIT, description: 'Seluruh kewajiban hutang perusahaan kepada pihak luar' },
        { code: '21000', name: 'LIABILITAS JANGKA PENDEK', category: AccountCategory.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '20000' },
        { code: '21100', name: 'Utang Usaha (Dagang)', category: AccountCategory.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '21000', description: 'Pembelian barang/jasa secara kredit' },
        { code: '21200', name: 'Beban Akrual / Yang Harus Dibayar', category: AccountCategory.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '21000' },
        { code: '21201', name: 'Utang Gaji', category: AccountCategory.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '21200' },
        { code: '21202', name: 'Utang Listrik & Telepon', category: AccountCategory.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '21200' },
        { code: '21300', name: 'Pendapatan Diterima di Muka', category: AccountCategory.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '21000' },
        { code: '21400', name: 'Utang Pajak', category: AccountCategory.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '21000' },
        { code: '21401', name: 'Utang PPN', category: AccountCategory.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '21400' },
        { code: '21402', name: 'Utang PPh Pasal 21', category: AccountCategory.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '21400' },
        { code: '22000', name: 'LIABILITAS JANGKA PANJANG', category: AccountCategory.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '20000' },
        { code: '22100', name: 'Utang Bank Jangka Panjang', category: AccountCategory.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '22000' },

        // EKUITAS
        { code: '30000', name: 'EKUITAS', category: AccountCategory.EQUITY, normalBalance: NormalBalance.CREDIT, description: 'Hak pemilik atas aset perusahaan setelah dikurangi kewajiban' },
        { code: '31100', name: 'Modal Saham Pendiri', category: AccountCategory.EQUITY, normalBalance: NormalBalance.CREDIT, parentCode: '30000' },
        { code: '31200', name: 'Tambahan Modal Disetor', category: AccountCategory.EQUITY, normalBalance: NormalBalance.CREDIT, parentCode: '30000' },
        { code: '31300', name: 'Laba Ditahan (Retained Earnings)', category: AccountCategory.EQUITY, normalBalance: NormalBalance.CREDIT, parentCode: '30000' },
        { code: '31400', name: 'Dividen', category: AccountCategory.EQUITY, normalBalance: NormalBalance.DEBIT, parentCode: '30000', description: 'Pembagian laba kepada pemegang saham' },
        { code: '31500', name: 'Ikhtisar Laba Rugi', category: AccountCategory.EQUITY, normalBalance: NormalBalance.CREDIT, parentCode: '30000' },

        // PENDAPATAN
        { code: '40000', name: 'PENDAPATAN', category: AccountCategory.REVENUE, normalBalance: NormalBalance.CREDIT, description: 'Hasil dari aktivitas operasional utama perusahaan' },
        { code: '41000', name: 'Pendapatan Usaha', category: AccountCategory.REVENUE, normalBalance: NormalBalance.CREDIT, parentCode: '40000' },
        { code: '41100', name: 'Pendapatan Penjualan Jasa', category: AccountCategory.REVENUE, normalBalance: NormalBalance.CREDIT, parentCode: '41000' },
        { code: '41200', name: 'Pendapatan Penjualan Produk', category: AccountCategory.REVENUE, normalBalance: NormalBalance.CREDIT, parentCode: '41000' },
        { code: '41300', name: 'Retur & Potongan Penjualan', category: AccountCategory.REVENUE, normalBalance: NormalBalance.DEBIT, parentCode: '41000' },
        { code: '42000', name: 'Pendapatan Luar Usaha', category: AccountCategory.REVENUE, normalBalance: NormalBalance.CREDIT, parentCode: '40000' },
        { code: '42100', name: 'Pendapatan Bunga Jasa Giro/Deposito', category: AccountCategory.REVENUE, normalBalance: NormalBalance.CREDIT, parentCode: '42000' },

        // BEBAN
        { code: '50000', name: 'BEBAN', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, description: 'Seluruh biaya pengeluaran operasional & non-operasional' },
        { code: '51000', name: 'BEBAN OPERASIONAL', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '50000' },
        { code: '51100', name: 'Harga Pokok Penjualan (HPP)', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '51000' },
        { code: '51200', name: 'Beban Gaji, Upah & Tunjangan', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '51000' },
        { code: '51300', name: 'Beban Sewa Kantor', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '51000' },
        { code: '51400', name: 'Beban Listrik, Air & Internet', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '51000' },
        { code: '51500', name: 'Beban Perlengkapan & ATK', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '51000' },
        { code: '51600', name: 'Beban Pemasaran & Promosi', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '51000' },
        { code: '51700', name: 'Beban Transportasi & Perjalanan Dinas', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '51000' },
        { code: '51800', name: 'Beban Penyusutan Aset Tetap', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '51000' },
        { code: '51900', name: 'Beban Administrasi Bank', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '51000' },
        { code: '52000', name: 'Beban Luar Usaha', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '50000' },
        { code: '52100', name: 'Beban Bunga Pinjaman Bank', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '52000' }
      ];

      const coaIds: Record<string, string> = {};
      for (const acc of standardAccounts) {
        const { parentCode, ...data } = acc as any;
        const parentId = parentCode ? coaIds[parentCode] : null;
        const finalData = { ...data, parentId };
        const id = await addDocument('coa', finalData);
        coaIds[acc.code] = id;
      }

      toast.success("Bagan Akun (COA) Standar PSAK Indonesia telah berhasil diunggah!");
    } catch (err) {
      console.error(err);
      toast.error("Gagal melakukan pengunggahan bagan akun standar.");
    } finally {
      setIsSeeding(false);
    }
  };

  const filtered = coas.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.code.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
             <span>Master Akuntansi</span>
             <span aria-hidden="true">·</span>
             <span>Standar SAK ETAP / PSAK Indonesia</span>
           </div>
           <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Bagan Akun (Chart of Accounts)</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button 
            variant="outline"
            onClick={seedPSAKAccounts}
            disabled={isSeeding}
            className="h-9 rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-sm transition-colors"
          >
            {isSeeding ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-blue-600" />}
            Impor Akun Standar PSAK
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input 
              placeholder="Cari kode atau nama akun..." 
              className="pl-8 w-60 h-9 rounded-lg border-slate-200 bg-white text-xs focus-visible:ring-blue-600/20 transition-all shadow-none"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if(!open) setEditingCoa(null); }}>
            <DialogTrigger 
              render={
                <Button className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Tambah Akun Baru
                </Button>
              }
            />
            <DialogContent className="max-w-md bg-white border-slate-200 rounded-xl p-0 overflow-hidden shadow-xl">
              <form onSubmit={handleSubmit}>
                <DialogHeader className="p-5 border-b border-slate-100 bg-slate-50/50">
                  <DialogTitle className="text-base font-bold text-slate-900">{editingCoa ? 'Ubah Akun Perkiraan' : 'Tambah Akun Perkiraan Baru'}</DialogTitle>
                </DialogHeader>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600">Kode Akun</label>
                        <Input 
                          required
                          placeholder="Contoh: 11101" 
                          className="rounded-lg border-slate-200 bg-white h-9 text-xs font-mono"
                          value={formData.code}
                          onChange={e => setFormData({...formData, code: e.target.value})}
                        />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600">Klasifikasi Kategori</label>
                        <Select 
                          value={formData.category} 
                          onValueChange={(v: any) => setFormData({...formData, category: v, normalBalance: v === AccountCategory.ASSET || v === AccountCategory.EXPENSE ? NormalBalance.DEBIT : NormalBalance.CREDIT})}
                        >
                          <SelectTrigger className="rounded-lg border-slate-200 bg-white h-9 text-xs">
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg text-xs">
                             {Object.values(AccountCategory).map(cat => (
                               <SelectItem key={cat} value={cat} className="rounded-md">{cat}</SelectItem>
                             ))}
                          </SelectContent>
                        </Select>
                     </div>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-medium text-slate-600">Nama Akun</label>
                     <Input 
                       required
                       placeholder="Contoh: Kas Kecil Operasional" 
                       className="rounded-lg border-slate-200 bg-white h-9 text-xs" 
                       value={formData.name}
                       onChange={e => setFormData({...formData, name: e.target.value})}
                     />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-medium text-slate-600">Saldo Normal</label>
                     <Select value={formData.normalBalance} onValueChange={(v: any) => setFormData({...formData, normalBalance: v})}>
                        <SelectTrigger className="rounded-lg border-slate-200 bg-white h-9 text-xs">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg text-xs">
                           {Object.values(NormalBalance).map(bal => (
                             <SelectItem key={bal} value={bal} className="rounded-md">{bal}</SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-medium text-slate-600">Akun Induk (Parent)</label>
                     <Select 
                       value={formData.parentId} 
                       onValueChange={(v: string) => setFormData({...formData, parentId: v})}
                     >
                        <SelectTrigger className="rounded-lg border-slate-200 bg-white h-9 text-xs">
                           <SelectValue placeholder="Tanpa Induk (Tingkat Utama)" />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg text-xs">
                           <SelectItem value="none" className="rounded-md text-slate-500">Tanpa Induk (Level 1)</SelectItem>
                           {coas
                             .filter(c => c.category === formData.category && c.id !== editingCoa?.id)
                             .map(coa => (
                               <SelectItem key={coa.id} value={coa.id!} className="rounded-md">
                                 <span className="font-mono">{coa.code}</span> - {coa.name}
                               </SelectItem>
                             ))}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-medium text-slate-600">Catatan / Deskripsi (Opsional)</label>
                     <Input 
                       placeholder="Keterangan alokasi akun" 
                       className="rounded-lg border-slate-200 bg-white h-9 text-xs" 
                       value={formData.description}
                       onChange={e => setFormData({...formData, description: e.target.value})}
                     />
                  </div>
                </div>
                <DialogFooter className="p-4 bg-slate-50/70 border-t border-slate-100">
                  <Button type="submit" className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm">
                    {editingCoa ? 'Perbarui Akun' : 'Simpan Akun ke Bagan'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden mb-8">
        <Table>
          <TableHeader className="bg-slate-50/70">
            <TableRow className="border-b border-slate-200 h-10">
              <TableHead className="w-[140px] font-semibold text-xs text-slate-600 pl-6">Kode Akun</TableHead>
              <TableHead className="font-semibold text-xs text-slate-600">Nama Akun Perkiraan</TableHead>
              <TableHead className="font-semibold text-xs text-slate-600">Kategori</TableHead>
              <TableHead className="font-semibold text-xs text-slate-600">Saldo Normal</TableHead>
              <TableHead className="text-right font-semibold text-xs text-slate-600 pr-6">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="h-48 text-center text-xs font-medium text-slate-400">Sinkronisasi bagan akun...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-48 text-center text-xs font-medium text-slate-400">Tidak ada akun yang sesuai dengan pencarian.</TableCell></TableRow>
            ) : filtered.map((coa) => {
              const depth = (coaId: string, count = 0): number => {
                const item = coas.find(c => c.id === coaId);
                if (item?.parentId && count < 5) return depth(item.parentId, count + 1);
                return count;
              };
              const currentDepth = coa.parentId ? depth(coa.parentId) + 1 : 0;

              return (
                <TableRow key={coa.id} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0 h-14">
                  <TableCell className="font-mono tabular-nums text-slate-800 text-xs pl-6" style={{ paddingLeft: `${24 + (currentDepth * 16)}px` }}>
                    <div className="flex items-center gap-2">
                      {currentDepth > 0 && <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                      <span className={cn(currentDepth === 0 ? "font-bold text-slate-900" : "font-medium text-slate-700")}>
                        {coa.code}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className={cn(
                        "text-xs",
                        currentDepth === 0 ? "font-bold text-slate-900" : "font-medium text-slate-700"
                      )}>{coa.name}</span>
                      {coa.description && (
                        <span className="text-[11px] text-slate-400 mt-0.5">{coa.description}</span>
                      )}
                    </div>
                  </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      coa.category === AccountCategory.ASSET && "bg-blue-600",
                      coa.category === AccountCategory.LIABILITY && "bg-amber-600",
                      coa.category === AccountCategory.EQUITY && "bg-indigo-600",
                      coa.category === AccountCategory.REVENUE && "bg-emerald-600",
                      coa.category === AccountCategory.EXPENSE && "bg-rose-600",
                    )} />
                    <span className="text-slate-700">{coa.category}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs font-mono text-slate-500 uppercase">{coa.normalBalance}</TableCell>
                <TableCell className="text-right pr-6">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={
                      <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-100 rounded-md transition-colors">
                        <MoreHorizontal className="h-3.5 w-3.5 text-slate-400" />
                      </Button>
                    } />
                    <DropdownMenuContent align="end" className="rounded-lg border-slate-200 shadow-md min-w-[140px] p-1 text-xs">
                      <DropdownMenuItem onClick={() => { 
                        setEditingCoa(coa); 
                        setFormData({
                          code: coa.code, 
                          name: coa.name, 
                          category: coa.category, 
                          normalBalance: coa.normalBalance, 
                          description: coa.description || '',
                          parentId: coa.parentId || 'none'
                        }); 
                        setIsAddOpen(true); 
                      }} className="gap-2 cursor-pointer rounded-md px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                        <Edit2 className="w-3.5 h-3.5" /> Ubah Akun
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(coa.id!)} className="gap-2 cursor-pointer rounded-md px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50">
                        <Trash2 className="w-3.5 h-3.5" /> Hapus Akun
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        </Table>
      </div>
    </div>
  );
}
