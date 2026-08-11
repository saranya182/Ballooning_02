import { useParams } from 'react-router-dom';
import { Download, FileText, Table2 } from 'lucide-react';
import api from '../services/api';

export default function Export() {
  const { id } = useParams();

  const exportData = async () => {
    await api.post(`/projects/${id}/export`, { type: 'pdf' });
    alert('Export started');
  };

  return (
    <div className="max-w-5xl mx-auto rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Export</h1>
      <p className="text-slate-600">Generate ballooned drawing output and inspection reports.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <button onClick={exportData} className="rounded-lg border border-slate-300 p-4 text-left flex items-center gap-3 hover:bg-slate-50">
          <FileText size={18} />
          <span>Export Ballooned Drawing PDF</span>
        </button>
        <button onClick={exportData} className="rounded-lg border border-slate-300 p-4 text-left flex items-center gap-3 hover:bg-slate-50">
          <Table2 size={18} />
          <span>Export Inspection Report Excel</span>
        </button>
      </div>
    </div>
  );
}
