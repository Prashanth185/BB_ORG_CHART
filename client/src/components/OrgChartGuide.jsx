import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

export default function OrgChartGuide() {
  const [open, setOpen] = useState(true);

  return (
    <div className="card mb-4 border-primary-100 bg-primary-50/30">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="flex items-center gap-2 font-semibold text-primary-900">
          <BookOpen className="w-5 h-5" />
          How to build a chart like &quot;GCC – May 2026&quot;
        </span>
        {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {open && (
        <ol className="mt-4 space-y-3 text-sm text-gray-700 list-decimal list-inside">
          <li>
            <strong>Add the Director first</strong> — Employees → Add Employee (e.g. Prabhu Sankar, Director – India). Leave &quot;Reporting To&quot; empty for the top role.
          </li>
          <li>
            <strong>Add each person below</strong> — For every name on your PowerPoint chart, add an employee. In <strong>Reporting To</strong>, select their manager (e.g. Maruti Srinivas → reports to Prabhu Sankar).
          </li>
          <li>
            <strong>Use Designation for role + count</strong> — Type exactly as on your slide, e.g. <code className="bg-white px-1 rounded">Asso. Director (12)</code> or <code className="bg-white px-1 rounded">Head - OHL (8)</code>.
          </li>
          <li>
            <strong>Department = group label</strong> — Set Department to <code className="bg-white px-1 rounded">PTD</code> for everyone inside the red PTD box (shows in red on pro cards).
          </li>
          <li>
            <strong>Org Chart → Custom (Drag &amp; Edit)</strong> — Set title to <strong>GCC – May 2026</strong>, enable <strong>Professional theme</strong> and <strong>Orthogonal lines</strong>.
          </li>
          <li>
            <strong>Auto Arrange Boxes</strong> — Builds the tree from reporting lines (like your blue hierarchy).
          </li>
          <li>
            <strong>Drag boxes</strong> — Move people into columns to match your slide (PTD left, HR/Finance right, etc.). Positions save automatically.
          </li>
          <li>
            <strong>Add lines</strong> — Use <strong>Add Line</strong> or <strong>Connect on Chart</strong> (click manager, then employee).
          </li>
          <li>
            <strong>Edit lines</strong> — Click a line on the chart, or use <strong>Edit</strong> in the list below the chart.
          </li>
          <li>
            <strong>Font &amp; colors</strong> — Click the <strong>purple palette</strong> icon on any box.
          </li>
          <li>
            <strong>Expand / Collapse</strong> — Click the <strong>blue +/-</strong> button on boxes with teams to hide or show direct reports.
          </li>
          <li>
            <strong>Click any line</strong> — Set color, thickness, and line type in the popup.
          </li>
          <li>
            <strong>Upload photos</strong> — Open each profile → Upload Profile Photo (optional).
          </li>
          <li>
            <strong>Export PNG or PDF</strong> — Top-right buttons when finished.
          </li>
        </ol>
      )}
    </div>
  );
}
