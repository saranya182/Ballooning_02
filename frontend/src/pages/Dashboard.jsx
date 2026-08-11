import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Plus,
  FolderKanban,
  FileCheck2,
  Eye,
  PencilLine,
  Trash2,
  Copy,
  CheckCircle2
} from 'lucide-react';

import api from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // --------------------------------------------------
  // LOAD PROJECTS
  // --------------------------------------------------
  const loadProjects = async () => {
    try {
      setLoading(true);

      const data = await api.get('/projects');

      setProjects(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // --------------------------------------------------
  // OPEN PROJECT
  // --------------------------------------------------
  const openProject = (id) => {
    navigate(`/projects/${id}`);
  };

  // --------------------------------------------------
  // EDIT PROJECT
  // --------------------------------------------------
  const editProject = (id) => {
    navigate(`/new-project?edit=${id}`);
  };

  // --------------------------------------------------
  // DELETE PROJECT
  // --------------------------------------------------
  const deleteProject = async (project) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete project "${project.projectNumber}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(project._id);

      await api.delete(`/projects/${project._id}`);

      // Remove deleted project immediately from UI
      setProjects((currentProjects) =>
        currentProjects.filter((p) => p._id !== project._id)
      );

      alert(`Project ${project.projectNumber} deleted successfully.`);
    } catch (error) {
      console.error('Delete project failed:', error);

      alert(
        error?.response?.data?.message ||
        'Unable to delete the project. Please try again.'
      );
    } finally {
      setActionLoading(null);
    }
  };

  // --------------------------------------------------
  // DUPLICATE / COPY PROJECT
  // --------------------------------------------------
  const copyProject = async (project) => {
    const confirmed = window.confirm(
      `Create a copy of project "${project.projectNumber}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(project._id);

      /*
       * The backend needs to support:
       * POST /projects/:id/duplicate
       *
       * with the original project ID.
       */

      const copiedProject = await api.post(
        `/projects/${project._id}/duplicate`
      );

      // If backend returns the newly created project
      if (copiedProject) {
        setProjects((currentProjects) => [
          copiedProject,
          ...currentProjects
        ]);
      } else {
        await loadProjects();
      }

      alert('Project copied successfully.');
    } catch (error) {
      console.error('Copy project failed:', error);

      alert(
        error?.response?.data?.message ||
        'Copy operation is not available yet in the backend.'
      );
    } finally {
      setActionLoading(null);
    }
  };

  // --------------------------------------------------
  // DASHBOARD CARDS
  // --------------------------------------------------
  const cards = [
    {
      label: 'Total Projects',
      value: projects.length,
      icon: FolderKanban
    },
    {
      label: 'Draft Projects',
      value: projects.filter((p) => p.status === 'Draft').length,
      icon: FileCheck2
    },
    {
      label: 'Under Review',
      value: projects.filter((p) => p.status === 'Under Review').length,
      icon: Eye
    },
    {
      label: 'Approved Projects',
      value: projects.filter((p) => p.status === 'Approved').length,
      icon: CheckCircle2
    }
  ];

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Dashboard
          </h1>

          <p className="text-slate-600">
            Track projects, ballooning status, and inspection progress.
          </p>
        </div>

        <Link
          to="/new-project"
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
        >
          <Plus size={16} />
          New Inspection Project
        </Link>
      </div>

      {/* DASHBOARD CARDS */}
      <div className="grid gap-4 md:grid-cols-4">

        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between text-slate-500">
                <span>{card.label}</span>
                <Icon size={18} />
              </div>

              <div className="mt-3 text-3xl font-semibold text-slate-900">
                {card.value}
              </div>
            </div>
          );
        })}

      </div>

      {/* PROJECT TABLE */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">

        <div className="px-4 py-3 border-b text-slate-700 font-semibold">
          Recent Projects
        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead className="bg-slate-50 text-slate-600">

              <tr>
                <th className="px-4 py-3 text-left">
                  Project Number
                </th>

                <th className="px-4 py-3 text-left">
                  Customer
                </th>

                <th className="px-4 py-3 text-left">
                  Part Number
                </th>

                <th className="px-4 py-3 text-left">
                  Drawing Number
                </th>

                <th className="px-4 py-3 text-left">
                  Revision
                </th>

                <th className="px-4 py-3 text-left">
                  Status
                </th>

                <th className="px-4 py-3 text-left">
                  Created
                </th>

                <th className="px-4 py-3 text-left">
                  Created By
                </th>

                <th className="px-4 py-3 text-left">
                  Actions
                </th>
              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>
                  <td
                    colSpan="9"
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Loading projects...
                  </td>
                </tr>

              ) : projects.length === 0 ? (

                <tr>
                  <td
                    colSpan="9"
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No projects found.
                  </td>
                </tr>

              ) : (

                projects.map((project) => (

                  <tr
                    key={project._id}
                    className="border-t hover:bg-slate-50"
                  >

                    <td className="px-4 py-3 font-medium">
                      {project.projectNumber}
                    </td>

                    <td className="px-4 py-3">
                      {project.customerName}
                    </td>

                    <td className="px-4 py-3">
                      {project.partNumber}
                    </td>

                    <td className="px-4 py-3">
                      {project.drawingNumber}
                    </td>

                    <td className="px-4 py-3">
                      {project.revision}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          project.status === 'Approved'
                            ? 'bg-green-100 text-green-700'
                            : project.status === 'Under Review'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {project.status}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {project.createdAt
                        ? new Date(project.createdAt).toLocaleDateString()
                        : '-'}
                    </td>

                    <td className="px-4 py-3">
                      {project.createdBy || '-'}
                    </td>

                    {/* ACTIONS */}
                    <td className="px-4 py-3">

                      <div className="flex items-center gap-2">

                        {/* OPEN */}
                        <button
                          onClick={() => openProject(project._id)}
                          title="Open project"
                          className="rounded border px-2 py-1 text-slate-700 hover:bg-slate-100"
                        >
                          Open
                        </button>

                        {/* EDIT */}
                        <button
                          onClick={() => editProject(project._id)}
                          title="Edit project"
                          disabled={actionLoading === project._id}
                          className="rounded border p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          <PencilLine size={14} />
                        </button>

                        {/* DELETE */}
                        <button
                          onClick={() => deleteProject(project)}
                          title="Delete project"
                          disabled={actionLoading === project._id}
                          className="rounded border p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>

                        {/* COPY */}
                        <button
                          onClick={() => copyProject(project)}
                          title="Copy project"
                          disabled={actionLoading === project._id}
                          className="rounded border p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          <Copy size={14} />
                        </button>

                      </div>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}