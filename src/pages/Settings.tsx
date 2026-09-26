import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileSpreadsheet, 
  Trash2, 
  Settings as SettingsIcon, 
  ShieldAlert,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Play,
  ShieldCheck,
  ArrowRight,
  Building2,
  Sliders,
  Save,
  Lock,
  Globe,
  Layers,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useAuth } from '../lib/AuthContext';
import { addDocument, subscribeToCollection, deleteDocument } from '../services/db';
import { AccountCategory, NormalBalance, JournalStatus, COA } from '../types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { openMCPModal } from '../lib/mcp';

interface ProgressStep {
  label: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
}

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [coas, setCoas] = React.useState<COA[]>([]);
  const [activeTab, setActiveTab] = React.useState<string>('general');

  // Company and Accounting Profile State
  const [companyInfo, setCompanyInfo] = React.useState({
    name: localStorage.getItem('lentera_company_name') || 'PT Lentera Digital Nusantara',
    taxId: localStorage.getItem('lentera_company_tax_id') || '01.234.567.8-901.000',
    fiscalYear: localStorage.getItem('lentera_company_fiscal_year') || '2026',
    currency: 'IDR (Rp - Indonesian Rupiah)',
    accountingStandard: 'SAK ETAP / PSAK Entitas Privat',
    accountingMethod: 'Accrual Basis (Berpasangan)'
  });
  const [isSavingCompany, setIsSavingCompany] = React.useState(false);

  const handleSaveCompanyInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCompany(true);
    localStorage.setItem('lentera_company_name', companyInfo.name);
    localStorage.setItem('lentera_company_tax_id', companyInfo.taxId);
    localStorage.setItem('lentera_company_fiscal_year', companyInfo.fiscalYear);
    setTimeout(() => {
      setIsSavingCompany(false);
      toast.success("Profil dan parameter entitas akuntansi berhasil disimpan!");
    }, 400);
  };
  
  // Custom dialog state
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = React.useState(false);
  
  // Progress modal state
  const [progress, setProgress] = React.useState<{
    isOpen: boolean;
    title: string;
    description: string;
    steps: ProgressStep[];
    currentStep: number;
  }>({
    isOpen: false,
    title: '',
    description: '',
    steps: [],
    currentStep: 0
  });

  React.useEffect(() => {
    if (!user) return;
    return subscribeToCollection<COA>('coa', setCoas);
  }, [user]);

  // Execute clearing of all database records
  const executeClearAllData = async () => {
    if (!user) return;
    setShowClearConfirm(false);
    
    // Set up step-by-step progress
    const steps: ProgressStep[] = [
      { label: 'Menghapus Rekaman Jurnal & Posting Buku Besar', status: 'idle' },
      { label: 'Menghapus Anggaran/Budget Bulanan', status: 'idle' },
      { label: 'Menghapus Jadwal Pembayaran Kas & Bank', status: 'idle' },
      { label: 'Menghapus Data Bagan Akun (COA Master)', status: 'idle' }
    ];

    setProgress({
      isOpen: true,
      title: 'Membersihkan Seluruh Database',
      description: 'Sedang menghapus seluruh rekaman transaksional dan bagan akun Anda...',
      steps,
      currentStep: 0
    });

    try {
      const collections = ['journals', 'budgets', 'scheduledPayments', 'coa'];
      let orException = null;
      
      for (let i = 0; i < collections.length; i++) {
        const collName = collections[i];
        
        // Update progress state for current step
        setProgress(prev => {
          const updated = [...prev.steps];
          updated[i].status = 'running';
          return { ...prev, steps: updated, currentStep: i };
        });

        try {
          // Retrieve documents for user
          const q = query(collection(db, collName), where('userId', '==', user.uid));
          const snapshot = await getDocs(q);
          
          if (snapshot.size > 0) {
            const deletePromises = snapshot.docs.map(docSnap => deleteDocument(collName, docSnap.id));
            await Promise.all(deletePromises);
          }

          // Also clean up budgetTransactions when budgets are deleted
          if (collName === 'budgets') {
            const qTx = query(collection(db, 'budgetTransactions'), where('userId', '==', user.uid));
            const snapshotTx = await getDocs(qTx);
            if (snapshotTx.size > 0) {
              const deletePromisesTx = snapshotTx.docs.map(docSnap => deleteDocument('budgetTransactions', docSnap.id));
              await Promise.all(deletePromisesTx);
            }
          }

          // Complete step status
          setProgress(prev => {
            const updated = [...prev.steps];
            updated[i].status = 'completed';
            return { ...prev, steps: updated };
          });
        } catch (stepErr) {
          console.error(`Gagal membersihkan koleksi ${collName}:`, stepErr);
          orException = stepErr;
          setProgress(prev => {
            const updated = [...prev.steps];
            updated[i].status = 'failed';
            return { ...prev, steps: updated };
          });
        }
        
        // Minor delay for visual presentation of loading steps
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (orException) {
        toast.error("Pembersihan selesai dengan beberapa kesalahan akses data.");
      } else {
        toast.success("Database berhasil dibersihkan!");
      }
      
      // Keep progress open for 1.5 seconds so user can see all completed checkmarks
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (err) {
      console.error(err);
      toast.error("Proses pembersihan gagal. Silakan coba kembali.");
    } finally {
      setProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  // Execute seeding of PSAK standard accounts & sample transactions
  const executeSeedAllData = async () => {
    if (!user) return;
    setShowSeedConfirm(false);

    // Set up step-by-step progress
    const steps: ProgressStep[] = [
      { label: 'Membuat Bagan Akun Standar PSAK Indonesia', status: 'idle' },
      { label: 'Membuat Contoh Jurnal Umum & Setoran Modal', status: 'idle' },
      { label: 'Membuat Target Anggaran/Budget Operasional', status: 'idle' },
      { label: 'Membuat Jadwal Pembayaran Beban Harian', status: 'idle' }
    ];

    setProgress({
      isOpen: true,
      title: 'Mempersiapkan Data Contoh Standar PSAK',
      description: 'Menyusun bagan akun, transaksi jurnal akrual, budget, dan tagihan terjadwal...',
      steps,
      currentStep: 0
    });

    try {
      // Step 1: Seed COA
      setProgress(prev => {
        const updated = [...prev.steps];
        updated[0].status = 'running';
        return { ...prev, steps: updated, currentStep: 0 };
      });

      const standardAccounts = [
        // ASET
        { code: '10000', name: 'ASET', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, description: 'Klasifikasi utama seluruh kekayaan perusahaan' },
        { code: '11000', name: 'ASET LANCAR', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '10000', description: 'Sumber daya yang mudah dicairkan kurang dari satu tahun' },
        { code: '11100', name: 'Kas & Setara Kas', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '11000', description: 'Kas di perusahaan dan rekening bank utama' },
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

      // Complete step 1
      setProgress(prev => {
        const updated = [...prev.steps];
        updated[0].status = 'completed';
        updated[1].status = 'running';
        return { ...prev, steps: updated, currentStep: 1 };
      });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 2: Seed journals
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();

      const journals = [
        {
          date: new Date(currentYear, currentMonth, 1),
          description: 'Setoran Modal Awal Pendiri Perusahaan',
          reference: 'JV/001',
          status: JournalStatus.POSTED,
          entries: [
            { coaId: coaIds['11102'], debit: 750000000, credit: 0 }, // Bank BCA
            { coaId: coaIds['31100'], debit: 0, credit: 750000000 }, // Modal Saham Pendiri
          ],
          totalDebit: 750000000,
          totalCredit: 750000000
        },
        {
          date: new Date(currentYear, currentMonth, 5),
          description: 'Pendapatan Penjualan Produk IT Solusi',
          reference: 'INV/001',
          status: JournalStatus.POSTED,
          entries: [
            { coaId: coaIds['11102'], debit: 45000000, credit: 0 }, // Bank BCA
            { coaId: coaIds['41200'], debit: 0, credit: 45000000 }, // Pendapatan Penjualan Produk
          ],
          totalDebit: 45000000,
          totalCredit: 45000000
        },
        {
          date: new Date(currentYear, currentMonth, 10),
          description: 'Pembelian Perlengkapan Kantor Harian',
          reference: 'EXP/001',
          status: JournalStatus.POSTED,
          entries: [
            { coaId: coaIds['11302'], debit: 2500000, credit: 0 }, // Perlengkapan Kantor
            { coaId: coaIds['11101'], debit: 0, credit: 2500000 }, // Kas Kecil
          ],
          totalDebit: 2500000,
          totalCredit: 2500000
        },
        {
          date: new Date(currentYear, currentMonth, 15),
          description: 'Pembayaran Beban Internet & Server Cloud Bulanan',
          reference: 'EXP/002',
          status: JournalStatus.POSTED,
          entries: [
            { coaId: coaIds['51400'], debit: 4000000, credit: 0 }, // Beban Internet & Server
            { coaId: coaIds['11101'], debit: 0, credit: 4000000 }, // Kas Kecil
          ],
          totalDebit: 4000000,
          totalCredit: 4000000
        }
      ];

      for (const j of journals) {
        await addDocument('journals', j);
      }

      // Complete step 2
      setProgress(prev => {
        const updated = [...prev.steps];
        updated[1].status = 'completed';
        updated[2].status = 'running';
        return { ...prev, steps: updated, currentStep: 2 };
      });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 3: Seed Budgets
      const period = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      const budgets = [
        { coaId: coaIds['51200'], period, amount: 60000000, actual: 0 }, // Beban Gaji & Upah
        { coaId: coaIds['51300'], period, amount: 20000000, actual: 0 }, // Beban Sewa Kantor
        { coaId: coaIds['51400'], period, amount: 15000000, actual: 4000000 }, // Beban Listrik, Air & Internet
        { coaId: coaIds['41200'], period, amount: 150000000, actual: 45000000 } // Target Pendapatan Produk
      ];

      for (const b of budgets) {
        await addDocument('budgets', b);
      }

      // Seed budget transactions
      const budgetTransactions = [
        // Gaji & Upah (coaIds['51200'])
        { coaId: coaIds['51200'], amount: 50000000, type: 'Pengurangan', description: 'Pembayaran Gaji Karyawan Utama', date: new Date(currentYear, currentMonth, 15) },
        { coaId: coaIds['51200'], amount: 10000000, type: 'Pertambahan', description: 'Tambahan Alokasi Bonus Kuartal', date: new Date(currentYear, currentMonth, 16) },
        { coaId: coaIds['51200'], amount: 10000000, type: 'Pengurangan', description: 'Pembayaran Lembur Staff IT', date: new Date(currentYear, currentMonth, 18) },

        // Sewa Kantor (coaIds['51300'])
        { coaId: coaIds['51300'], amount: 15000000, type: 'Pengurangan', description: 'Sewa Ruang Meeting Co-Working', date: new Date(currentYear, currentMonth, 10) },

        // Listrik, Air & Internet (coaIds['51400'])
        { coaId: coaIds['51400'], amount: 2500000, type: 'Pengurangan', description: 'Tagihan Listrik PLN Kantor', date: new Date(currentYear, currentMonth, 5) },
        { coaId: coaIds['51400'], amount: 1500000, type: 'Pengurangan', description: 'Pembayaran Langganan Biznet', date: new Date(currentYear, currentMonth, 8) },
        { coaId: coaIds['51400'], amount: 5000000, type: 'Pertambahan', description: 'Alokasi Tambahan Operasional Cloud', date: new Date(currentYear, currentMonth, 12) }
      ];

      for (const bt of budgetTransactions) {
        await addDocument('budgetTransactions', bt);
      }

      // Complete step 3
      setProgress(prev => {
        const updated = [...prev.steps];
        updated[2].status = 'completed';
        updated[3].status = 'running';
        return { ...prev, steps: updated, currentStep: 3 };
      });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 4: Seed scheduled payments
      const schedules = [
        {
          dueDate: new Date(currentYear, currentMonth + 1, 1),
          amount: 15000000,
          description: 'Sewa Gedung Kantor Bulanan (PSAK)',
          coaId: coaIds['51300'],
          status: 'Pending'
        },
        {
          dueDate: new Date(currentYear, currentMonth, 28),
          amount: 32000000,
          description: 'Gaji Bulanan Staff IT & Desain',
          coaId: coaIds['51200'],
          status: 'Pending'
        }
      ];

      for (const s of schedules) {
        await addDocument('scheduledPayments', s);
      }

      // Complete step 4
      setProgress(prev => {
        const updated = [...prev.steps];
        updated[3].status = 'completed';
        return { ...prev, steps: updated };
      });

      toast.success("Ecosystem seeding completed. Semua data sampel siap!");
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (err) {
      console.error(err);
      toast.error("Proses seeding gagal.");
      setProgress(prev => {
        const updated = [...prev.steps];
        if (updated[prev.currentStep]) {
          updated[prev.currentStep].status = 'failed';
        }
        return { ...prev, steps: updated };
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    } finally {
      setProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  return (
    <div className="space-y-6 relative max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-white rounded-xl shadow-sm">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Pengaturan Sistem
            </h1>
          </div>
          <p className="text-sm text-slate-500 font-sans">
            Konfigurasi profil perusahaan, integrasi Agen AI (MCP), manajemen basis data PSAK, dan parameter keamanan.
          </p>
        </div>

        {/* Quick status pill */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200/80 text-xs font-medium text-slate-600 self-start md:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Lingkungan Produksi Aktif</span>
          <span className="text-slate-300">|</span>
          <span className="font-mono font-semibold text-slate-700">SAK ETAP / PSAK</span>
        </div>
      </div>

      <Separator className="bg-slate-200/80" />

      {/* Main Tabs Container */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val || 'general')} className="space-y-6">
        <TabsList className="bg-slate-100/90 p-1 rounded-xl h-auto border border-slate-200/70 inline-flex flex-wrap gap-1">
          <TabsTrigger 
            value="general" 
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold data-active:bg-white data-active:text-slate-900 data-active:shadow-sm transition-all"
          >
            <Building2 className="w-4 h-4 text-slate-500" />
            <span>Profil & Entitas</span>
          </TabsTrigger>

          <TabsTrigger 
            value="data" 
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold data-active:bg-white data-active:text-blue-900 data-active:shadow-sm transition-all"
          >
            <Database className="w-4 h-4 text-blue-600" />
            <span>Manajemen Data & PSAK</span>
          </TabsTrigger>

          <TabsTrigger 
            value="security" 
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold data-active:bg-white data-active:text-emerald-900 data-active:shadow-sm transition-all"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Keamanan & Akses</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PROFIL & ENTITAS */}
        <TabsContent value="general" className="space-y-6 outline-none animate-in fade-in-50 duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Profil Perusahaan */}
            <div className="lg:col-span-2">
              <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white overflow-hidden">
                <form onSubmit={handleSaveCompanyInfo}>
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900">
                          Identitas & Profil Entitas Pembukuan
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                          Data ini dicantumkan pada header laporan keuangan Neraca, Laba Rugi, dan Lembar Jurnal.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="company-name" className="text-xs font-bold text-slate-700">
                          Nama Perusahaan / Entitas
                        </Label>
                        <Input
                          id="company-name"
                          value={companyInfo.name}
                          onChange={(e) => setCompanyInfo(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Contoh: PT Lentera Digital Nusantara"
                          className="h-10 text-sm border-slate-200 focus-visible:ring-slate-900 rounded-xl"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="company-tax-id" className="text-xs font-bold text-slate-700">
                          NPWP (Nomor Pokok Wajib Pajak)
                        </Label>
                        <Input
                          id="company-tax-id"
                          value={companyInfo.taxId}
                          onChange={(e) => setCompanyInfo(prev => ({ ...prev, taxId: e.target.value }))}
                          placeholder="01.234.567.8-901.000"
                          className="h-10 text-sm border-slate-200 focus-visible:ring-slate-900 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="company-fiscal-year" className="text-xs font-bold text-slate-700">
                          Tahun Buku / Periode Fiskal Aktif
                        </Label>
                        <Input
                          id="company-fiscal-year"
                          value={companyInfo.fiscalYear}
                          onChange={(e) => setCompanyInfo(prev => ({ ...prev, fiscalYear: e.target.value }))}
                          placeholder="2026"
                          className="h-10 text-sm border-slate-200 focus-visible:ring-slate-900 rounded-xl"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="company-currency" className="text-xs font-bold text-slate-700">
                          Mata Uang Fungsional
                        </Label>
                        <Input
                          id="company-currency"
                          disabled
                          value={companyInfo.currency}
                          className="h-10 text-sm bg-slate-50 border-slate-200 text-slate-600 rounded-xl cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-slate-50/50 border-t border-slate-100 flex justify-end px-6 py-3.5">
                    <Button 
                      type="submit" 
                      disabled={isSavingCompany}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs h-9 px-4 rounded-xl shadow-sm"
                    >
                      {isSavingCompany ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5 mr-1.5" />
                          Simpan Profil Entitas
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>

            {/* Kebijakan Akuntansi */}
            <div className="space-y-6">
              <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900">
                        Parameter Akuntansi
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Ketentuan pembukuan yang diterapkan.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3.5">
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="text-xs text-slate-500">Standar Acuan</span>
                    <span className="text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      PSAK / SAK ETAP
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="text-xs text-slate-500">Sistem Pencatatan</span>
                    <span className="text-xs font-semibold text-slate-800">
                      Akrual Berpasangan
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="text-xs text-slate-500">Keseimbangan Debit = Kredit</span>
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Wajib Seimbang
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-xs text-slate-500">Kunci Periode Lampau</span>
                    <span className="text-xs font-semibold text-slate-700">
                      Aktif Otomatis
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-100 bg-gradient-to-br from-blue-50/60 to-white shadow-sm rounded-2xl p-4">
                <div className="flex gap-3 items-start">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-xl shrink-0 mt-0.5">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-blue-900">Standarisasi Chart of Accounts</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Sistem menggunakan struktur 5 digit berstandar Indonesia: 10000 (Aset), 20000 (Liabilitas), 30000 (Ekuitas), 40000 (Pendapatan), dan 50000 (Beban).
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: MANAJEMEN DATA & PSAK */}
        <TabsContent value="data" className="space-y-6 outline-none animate-in fade-in-50 duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Seed Data Standard */}
            <Card className="border-blue-100 shadow-sm rounded-2xl bg-white overflow-hidden">
              <CardHeader className="bg-blue-50/40 border-b border-blue-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Seed Master Data Standar PSAK Indonesia
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Suntikkan bagan akun (COA) lengkap dan data simulasi transaksi bisnis.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Fitur ini akan menyusun seluruh struktur pembukuan standar Indonesia secara otomatis:
                </p>

                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="font-semibold text-slate-800">40+ Daftar Bagan Akun (Aset, Hutang, Ekuitas, Pendapatan, Beban)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="font-semibold text-slate-800">Contoh Jurnal Umum Berpasangan (Setoran modal, penjualan, beban operasional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="font-semibold text-slate-800">Target Anggaran Bulanan & Monitoring Budget</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="font-semibold text-slate-800">Jadwal Pengeluaran & Agenda Kas-Bank</span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button 
                    id="btn-settings-seed-data"
                    onClick={() => setShowSeedConfirm(true)}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-sm"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Buka Panduan & Mulai Seed Data PSAK
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone: Clear Data */}
            <Card className="border-rose-200/80 shadow-sm rounded-2xl bg-white overflow-hidden">
              <CardHeader className="bg-rose-50/40 border-b border-rose-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 rounded-xl text-rose-600">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-rose-950">
                      Zona Bahaya (Pembersihan Database)
                    </CardTitle>
                    <CardDescription className="text-xs text-rose-600/80">
                      Tindakan permanen dan tidak dapat diurungkan.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Menghapus seluruh rekaman basis data akuntansi yang terkait dengan profil akun Anda:
                </p>

                <div className="space-y-2 bg-rose-50/40 p-4 rounded-xl border border-rose-100 text-xs">
                  <div className="flex items-center gap-2 text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Seluruh transaksi Jurnal Umum & Posting Buku Besar</span>
                  </div>
                  <div className="flex items-center gap-2 text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Seluruh Alokasi Anggaran / Budget Bulanan</span>
                  </div>
                  <div className="flex items-center gap-2 text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Seluruh Jadwal Pembayaran Kas & Bank</span>
                  </div>
                  <div className="flex items-center gap-2 text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Daftar Master Bagan Akun (COA)</span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button 
                    id="btn-settings-clear-data"
                    variant="outline"
                    onClick={() => setShowClearConfirm(true)}
                    className="w-full sm:w-auto border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-bold text-xs h-10 px-5 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Mulai Bersihkan Database
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Database Info Card */}
          <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 rounded-xl text-slate-700">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Status Basis Data Terkini</h4>
                  <p className="text-xs text-slate-500">
                    Terhubung ke Cloud Firestore real-time listener.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-lg">
                  <span className="text-slate-500 mr-2">Bagan Akun (COA):</span>
                  <strong className="text-slate-900 font-mono">{coas.length} Akun</strong>
                </div>
                <div className="bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-lg text-emerald-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Tersinkronisasi
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 4: KEAMANAN & AKSES */}
        <TabsContent value="security" className="space-y-6 outline-none animate-in fade-in-50 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Keamanan & Lingkungan */}
            <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Keamanan & Standarisasi Sistem
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Informasi kepatuhan, enkripsi, dan lingkungan eksekusi.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-3.5">
                <div className="flex justify-between items-center py-2 border-b border-slate-100 font-medium">
                  <span className="text-xs text-slate-500">Standar Akuntansi</span>
                  <Badge variant="secondary" className="font-bold text-[10px] uppercase tracking-wider">
                    PSAK / SAK ETAP
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100 font-medium">
                  <span className="text-xs text-slate-500">Multi-User Locking</span>
                  <span className="text-xs text-emerald-600 flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4" /> Enabled (Perlindungan Ganda)
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100 font-medium">
                  <span className="text-xs text-slate-500">Enkripsi Data</span>
                  <span className="text-xs text-slate-800 font-semibold">
                    TLS 1.3 / AES-256 (At-rest & In-transit)
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100 font-medium">
                  <span className="text-xs text-slate-500">Lingkungan Server</span>
                  <span className="text-xs text-slate-900 font-mono font-bold bg-slate-100 px-2 py-0.5 rounded">
                    Production-V4 (Cloud Run)
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Otorisasi Pengguna */}
            <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Otorisasi Akun & Sesi
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Kredensial dan hak akses pengguna saat ini.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-400 font-medium">Email Pengguna Aktif</Label>
                  <p className="text-sm font-semibold text-slate-900">
                    {user?.email || 'herimuhrial.mti@gmail.com'}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-400 font-medium">ID Pengguna Berwenang (UID)</Label>
                  <code className="text-xs font-mono text-slate-600 bg-slate-50 p-2 rounded-lg block border border-slate-100 break-all select-all">
                    {user?.uid || 'ai-studio-user-default'}
                  </code>
                </div>

                <div className="pt-2">
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800 text-xs px-2.5 py-1 font-semibold flex items-center gap-1.5 w-fit">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Akses Administrator / Lead Accountant Terverifikasi
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* CONFIRMATION SEED MODAL */}
      {showSeedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-up border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start">
              <div className="flex gap-3 items-center">
                <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-900">Seed Sistem PSAK Indonesia</h3>
              </div>
              <button 
                onClick={() => setShowSeedConfirm(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 font-sans text-sm text-slate-600">
              <p>
                Anda akan menyuntikkan data master Bagan Akun lengkap berstruktur standardisasi ikhtisar akuntansi Indonesia yang berisi:
              </p>
              <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold text-slate-800">40+ Daftar Akun Master (Aset, Hutang, Ekuitas, Pendapatan, Beban)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold text-slate-800">4 Transaksi Jurnal (Setoran modal pendiri, Jasa cloud, SAK, Server)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold text-slate-800">5 Target Anggaran (HPP, Gaji, Sewa, Server & Internet)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold text-slate-800">2 Jadwal Agenda Pembayaran Akrual</span>
                </div>
              </div>
              
              {coas.length > 0 && (
                <div className="p-3 bg-amber-50 text-amber-800 rounded-xl flex gap-2.5 items-start text-xs border border-amber-100">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-bold">Perhatian:</span> Sistem mendeteksi Chart of Accounts (COA) Anda tidak kosong. Data sampel akan digabungkan dengan data Anda yang sudah ada saat ini.
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowSeedConfirm(false)}
                className="rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-white"
              >
                Batal
              </Button>
              <Button 
                onClick={executeSeedAllData}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 shadow-sm"
              >
                <Play className="w-4 h-4 mr-1.5" />
                Mulakan Seed Data
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION CLEAR MODAL */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-up border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start">
              <div className="flex gap-3 items-center">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
                <h3 className="text-lg font-bold text-slate-900">Reset Semua Data?</h3>
              </div>
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 font-sans text-sm text-slate-600 space-y-3">
              <p>
                Tindakan ini bersifat <span className="font-bold text-rose-600">KRUSIAL & PERMANEN</span>. Menghapus seluruh rekaman basis data Anda:
              </p>
              <ul className="list-disc leading-relaxed pl-5 space-y-1 text-slate-500 text-xs">
                <li>Bagan Akun (Master Chart of Accounts)</li>
                <li>Seluruh Lembar Jurnal Umum & Buku Besar</li>
                <li>Semua Alokasi Anggaran Bulanan</li>
                <li>Seluruh Jadwal Pembatasan Cash & Bank</li>
              </ul>
              <p className="font-bold text-slate-800">
                Apakah Anda benar-benar yakin ingin membersihkan database?
              </p>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowClearConfirm(false)}
                className="rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-white animate-pulse"
              >
                Urungkan
              </Button>
              <Button 
                onClick={executeClearAllData}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-5 shadow-sm active:scale-95 transition-transform"
              >
                Hapus Permanen
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PROGRESS FLOW OVERLAY MODAL */}
      {progress.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 p-6 space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                {progress.title}
              </h3>
              <p className="text-xs text-slate-500">{progress.description}</p>
            </div>

            {/* Steps Progress Checklist */}
            <div className="space-y-4 border-t border-b border-slate-100 py-4 font-sans">
              {progress.steps.map((step, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm font-medium">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold font-mono flex items-center justify-center border transition-all ${
                      idx < progress.currentStep || step.status === 'completed'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm'
                        : idx === progress.currentStep && step.status === 'running'
                        ? 'bg-blue-50 border-blue-200 text-blue-600 animate-pulse'
                        : 'bg-slate-50 border-slate-100 text-slate-400'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className={`${
                      step.status === 'running' 
                        ? 'text-slate-800 font-bold' 
                        : step.status === 'completed'
                        ? 'text-slate-400 font-semibold line-through decoration-1'
                        : 'text-slate-500'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  <div>
                    {step.status === 'running' && (
                      <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 font-bold uppercase tracking-wider rounded border border-blue-100 animate-pulse">
                        Proses...
                      </span>
                    )}
                    {step.status === 'completed' && (
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-600 font-bold uppercase tracking-wider rounded border border-emerald-100 flex items-center gap-1">
                        Sukses
                      </span>
                    )}
                    {step.status === 'failed' && (
                      <span className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-600 font-bold uppercase tracking-wider rounded border border-rose-100">
                        Gagal
                      </span>
                    )}
                    {step.status === 'idle' && (
                      <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
                        Antrean
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Total progress visual bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wi">
                <span>Total Kemajuan</span>
                <span>{Math.round(((progress.steps.filter(s => s.status === 'completed').length) / progress.steps.length) * 100)}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-500 rounded-full"
                  style={{ width: `${((progress.steps.filter(s => s.status === 'completed').length) / progress.steps.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
