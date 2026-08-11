import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function NewProject() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    drawingNumber: 'DWG-1002',
    partName: 'Mounting Plate',
    customerName: 'ABC Engineering Pvt Ltd',
    revision: 'A',
    drawingDate: '2026-08-01',
    material: 'Aluminum 6061',
    customerPO: 'PO-300',
    invoiceNo: '',
    invoiceDate: '',
    quantity: '50',
    unit: 'mm',
    remarks: ''
  });

  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const project = await api.post('/projects', {
        ...form,
        createdBy: 'Admin User'
      });

      const file = fileRef.current?.files?.[0];

      if (file) {
        const formData = new FormData();
        formData.append('drawing', file);
        await api.upload(`/projects/${project._id}/drawing`, formData);
      }

      setMessage('Project saved');

      navigate(`/projects/${project._id}`);
    } catch (error) {
      setMessage(error.message || 'Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Create New Inspection Project</h1>
        <p className="text-slate-600">Capture project metadata and continue to the drawing workspace.</p>
      </div>

      {message ? <div className="mb-4 rounded bg-slate-50 p-3 text-slate-700">{message}</div> : null}

      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm text-slate-600">Drawing No *</span>
          <input required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.drawingNumber} onChange={set('drawingNumber')} />
        </label>

        <label className="block">
          <span className="text-sm text-slate-600">Part Name *</span>
          <input required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.partName} onChange={set('partName')} />
        </label>

        <label className="block">
          <span className="text-sm text-slate-600">Customer</span>
          <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.customerName} onChange={set('customerName')} />
        </label>

        <label className="block">
          <span className="text-sm text-slate-600">Revision</span>
          <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.revision} onChange={set('revision')} />
        </label>

        <label className="block">
          <span className="text-sm text-slate-600">Drawing Rev Date</span>
          <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.drawingDate} onChange={set('drawingDate')} />
        </label>

        <label className="block">
          <span className="text-sm text-slate-600">Material</span>
          <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.material} onChange={set('material')} />
        </label>

        <label className="block">
          <span className="text-sm text-slate-600">PO No</span>
          <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.customerPO} onChange={set('customerPO')} />
        </label>

        <label className="block">
          <span className="text-sm text-slate-600">Invoice No</span>
          <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.invoiceNo} onChange={set('invoiceNo')} />
        </label>

        <label className="block">
          <span className="text-sm text-slate-600">Invoice Date</span>
          <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.invoiceDate} onChange={set('invoiceDate')} />
        </label>

        <label className="block">
          <span className="text-sm text-slate-600">QTY</span>
          <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.quantity} onChange={set('quantity')} />
        </label>

        <label className="block">
          <span className="text-sm text-slate-600">Unit</span>
          <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={form.unit} onChange={set('unit')} />
        </label>

        <label className="md:col-span-2 block">
          <span className="text-sm text-slate-600">Notes</span>
          <textarea className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" rows="3" value={form.remarks} onChange={set('remarks')} />
        </label>

        <label className="md:col-span-2 block">
          <span className="text-sm text-slate-600">Drawing Image / PDF</span>
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="mt-1 w-full text-sm" />
        </label>

        <div className="md:col-span-2 flex gap-3">
          <button type="button" className="rounded-lg border border-slate-300 px-4 py-2">Save Draft</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-60">
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}
