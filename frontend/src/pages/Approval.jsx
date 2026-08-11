import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Approval() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('Under Review');

  useEffect(() => {
    api.get(`/projects/${id}`).then(setProject).catch(() => {});
  }, [id]);

  const submitApproval = async () => {
    await api.post(`/projects/${id}/approval`, { status, comments: comment, approvedBy: 'Admin User' });
    navigate(`/projects/${id}/export`);
  };

  return (
    <div className="max-w-5xl mx-auto rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Approval</h1>
      <p className="text-slate-600">Review project details and submit final inspection approval.</p>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <div className="font-semibold">Project information</div>
          <div className="mt-3 text-sm text-slate-600">Project: {project?.projectNumber}</div>
          <div className="text-sm text-slate-600">Customer: {project?.customerName}</div>
          <div className="text-sm text-slate-600">Part: {project?.partName}</div>
          <div className="text-sm text-slate-600">Drawing: {project?.drawingNumber} Rev {project?.revision}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="font-semibold">Approval actions</div>
          <select className="mt-3 w-full rounded border px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="Under Review">Submit for Review</option>
            <option value="Approved">Approve</option>
            <option value="Rejected">Reject</option>
            <option value="Request Changes">Request Changes</option>
          </select>
          <textarea className="mt-3 w-full rounded border px-3 py-2" rows="4" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Approval comments" />
          <button onClick={submitApproval} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-white">Submit</button>
        </div>
      </div>
    </div>
  );
}
